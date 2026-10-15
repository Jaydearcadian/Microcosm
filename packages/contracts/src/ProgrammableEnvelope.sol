// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title ProgrammableEnvelope
/// @notice A funded USDC spending boundary with deterministic onchain policy checks.
/// @dev The owner retains custody authority. Operators can spend only within the
///      automatic-approval limit. The owner can approve larger payments by sending
///      the transaction directly, but cannot bypass per-transaction, daily, schedule,
///      recipient, or available-balance checks.
contract ProgrammableEnvelope {
    IERC20 public immutable token;
    address public owner;

    uint256 public maxAmountPerTransaction;
    uint256 public maxAmountPerDay;
    uint256 public automaticApprovalLimit;
    uint8 public allowedDaysMask; // Monday = bit 0, Sunday = bit 6; UTC.
    uint8 public startHourUtc; // inclusive, 0..23
    uint8 public endHourUtc;   // exclusive, 1..24
    bool public recipientAllowlistEnabled;
    bool public paused;

    mapping(address => bool) public operators;
    mapping(address => bool) public allowedRecipients;
    mapping(uint256 => uint256) public spentByUtcDay;
    mapping(bytes32 => bool) public processedPaymentIds;
    uint256 private _entered;

    event Deposited(address indexed from, uint256 amount);
    event PaymentExecuted(bytes32 indexed paymentId, address indexed operator, address indexed recipient, uint256 amount, uint256 utcDay);
    event Withdrawn(address indexed owner, address indexed recipient, uint256 amount);
    event OperatorUpdated(address indexed operator, bool enabled);
    event RecipientUpdated(address indexed recipient, bool allowed);
    event PolicyUpdated(uint256 maxAmountPerTransaction, uint256 maxAmountPerDay, uint256 automaticApprovalLimit, uint8 allowedDaysMask, uint8 startHourUtc, uint8 endHourUtc, bool recipientAllowlistEnabled);
    event PauseUpdated(bool paused);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "ENVELOPE_ONLY_OWNER");
        _;
    }

    modifier nonReentrant() {
        require(_entered == 0, "ENVELOPE_REENTRANT");
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(
        address owner_,
        address token_,
        uint256 maxPerTransaction_,
        uint256 maxPerDay_,
        uint256 automaticApprovalLimit_,
        uint8 allowedDaysMask_,
        uint8 startHourUtc_,
        uint8 endHourUtc_,
        bool recipientAllowlistEnabled_,
        address[] memory initialRecipients_,
        address[] memory initialOperators_
    ) {
        require(owner_ != address(0), "ENVELOPE_OWNER_REQUIRED");
        require(token_ != address(0), "ENVELOPE_TOKEN_REQUIRED");
        owner = owner_;
        token = IERC20(token_);
        _setPolicy(maxPerTransaction_, maxPerDay_, automaticApprovalLimit_, allowedDaysMask_, startHourUtc_, endHourUtc_, recipientAllowlistEnabled_);
        for (uint256 i; i < initialRecipients_.length; ++i) {
            require(initialRecipients_[i] != address(0), "ENVELOPE_RECIPIENT_REQUIRED");
            allowedRecipients[initialRecipients_[i]] = true;
            emit RecipientUpdated(initialRecipients_[i], true);
        }
        for (uint256 i; i < initialOperators_.length; ++i) {
            require(initialOperators_[i] != address(0), "ENVELOPE_OPERATOR_REQUIRED");
            require(initialOperators_[i] != owner_, "ENVELOPE_OWNER_NOT_OPERATOR");
            operators[initialOperators_[i]] = true;
            emit OperatorUpdated(initialOperators_[i], true);
        }
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "ENVELOPE_AMOUNT_REQUIRED");
        require(token.transferFrom(msg.sender, address(this), amount), "ENVELOPE_DEPOSIT_FAILED");
        emit Deposited(msg.sender, amount);
    }

    /// @notice Execute a policy-checked payment from the envelope's balance.
    /// @dev `paymentId` must be unique at the application layer; emitted receipts
    ///      include it for deterministic reconciliation. This contract does not
    ///      attempt to interpret offchain natural-language instructions.
    function executePayment(bytes32 paymentId, address recipient, uint256 amount) external nonReentrant {
        require(!paused, "ENVELOPE_PAUSED");
        require(paymentId != bytes32(0), "ENVELOPE_PAYMENT_ID_REQUIRED");
        require(!processedPaymentIds[paymentId], "ENVELOPE_PAYMENT_ALREADY_PROCESSED");
        require(recipient != address(0), "ENVELOPE_RECIPIENT_REQUIRED");
        require(amount > 0, "ENVELOPE_AMOUNT_REQUIRED");
        require(msg.sender == owner || operators[msg.sender], "ENVELOPE_NOT_AUTHORIZED");
        require(amount <= maxAmountPerTransaction, "ENVELOPE_TX_LIMIT");
        if (msg.sender != owner) {
            require(amount <= automaticApprovalLimit, "ENVELOPE_OWNER_APPROVAL_REQUIRED");
        }
        if (recipientAllowlistEnabled) {
            require(allowedRecipients[recipient], "ENVELOPE_RECIPIENT_NOT_ALLOWED");
        }
        _checkSchedule();

        uint256 utcDay = block.timestamp / 1 days;
        uint256 nextDailySpend = spentByUtcDay[utcDay] + amount;
        require(nextDailySpend <= maxAmountPerDay, "ENVELOPE_DAILY_LIMIT");
        require(token.balanceOf(address(this)) >= amount, "ENVELOPE_INSUFFICIENT_FUNDS");

        // Effects before interaction. Revert rolls back spend accounting if transfer fails.
        spentByUtcDay[utcDay] = nextDailySpend;
        processedPaymentIds[paymentId] = true;
        require(token.transfer(recipient, amount), "ENVELOPE_PAYMENT_FAILED");
        emit PaymentExecuted(paymentId, msg.sender, recipient, amount, utcDay);
    }

    /// @notice The owner may withdraw funds that remain in the envelope.
    /// @dev Owner authority is intentional; this is not a trustless vault.
    function withdraw(uint256 amount, address recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "ENVELOPE_RECIPIENT_REQUIRED");
        require(amount > 0, "ENVELOPE_AMOUNT_REQUIRED");
        require(token.transfer(recipient, amount), "ENVELOPE_WITHDRAW_FAILED");
        emit Withdrawn(msg.sender, recipient, amount);
    }

    function setPolicy(
        uint256 maxPerTransaction_,
        uint256 maxPerDay_,
        uint256 automaticApprovalLimit_,
        uint8 allowedDaysMask_,
        uint8 startHourUtc_,
        uint8 endHourUtc_,
        bool recipientAllowlistEnabled_
    ) external onlyOwner {
        _setPolicy(maxPerTransaction_, maxPerDay_, automaticApprovalLimit_, allowedDaysMask_, startHourUtc_, endHourUtc_, recipientAllowlistEnabled_);
    }

    function setOperator(address operator, bool enabled) external onlyOwner {
        require(operator != address(0), "ENVELOPE_OPERATOR_REQUIRED");
        require(operator != owner, "ENVELOPE_OWNER_NOT_OPERATOR");
        operators[operator] = enabled;
        emit OperatorUpdated(operator, enabled);
    }

    function setRecipient(address recipient, bool allowed) external onlyOwner {
        require(recipient != address(0), "ENVELOPE_RECIPIENT_REQUIRED");
        allowedRecipients[recipient] = allowed;
        emit RecipientUpdated(recipient, allowed);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseUpdated(paused_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "ENVELOPE_OWNER_REQUIRED");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function availableBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function _setPolicy(
        uint256 maxPerTransaction_,
        uint256 maxPerDay_,
        uint256 automaticApprovalLimit_,
        uint8 allowedDaysMask_,
        uint8 startHourUtc_,
        uint8 endHourUtc_,
        bool recipientAllowlistEnabled_
    ) internal {
        require(maxPerTransaction_ > 0, "ENVELOPE_TX_LIMIT_REQUIRED");
        require(maxPerDay_ >= maxPerTransaction_, "ENVELOPE_DAY_LIMIT_TOO_LOW");
        require(automaticApprovalLimit_ <= maxPerTransaction_, "ENVELOPE_AUTO_LIMIT_TOO_HIGH");
        require(allowedDaysMask_ > 0 && (allowedDaysMask_ & 0x80) == 0, "ENVELOPE_DAYS_INVALID");
        require(startHourUtc_ < 24 && endHourUtc_ > 0 && endHourUtc_ <= 24 && startHourUtc_ < endHourUtc_, "ENVELOPE_HOURS_INVALID");

        maxAmountPerTransaction = maxPerTransaction_;
        maxAmountPerDay = maxPerDay_;
        automaticApprovalLimit = automaticApprovalLimit_;
        allowedDaysMask = allowedDaysMask_;
        startHourUtc = startHourUtc_;
        endHourUtc = endHourUtc_;
        recipientAllowlistEnabled = recipientAllowlistEnabled_;
        emit PolicyUpdated(maxPerTransaction_, maxPerDay_, automaticApprovalLimit_, allowedDaysMask_, startHourUtc_, endHourUtc_, recipientAllowlistEnabled_);
    }

    function _checkSchedule() internal view {
        uint256 utcDayIndex = (block.timestamp / 1 days + 3) % 7; // Monday = 0; Unix epoch began Thursday.
        require((allowedDaysMask & uint8(1 << utcDayIndex)) != 0, "ENVELOPE_DAY_NOT_ALLOWED");
        uint256 hourUtc = (block.timestamp % 1 days) / 1 hours;
        require(hourUtc >= startHourUtc && hourUtc < endHourUtc, "ENVELOPE_HOUR_NOT_ALLOWED");
    }
}

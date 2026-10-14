# Arc Onchain Settlement Verification Evidence

**Generated:** 2026-10-14T14:35:04.642Z  
**Network:** Arc Testnet (Chain ID 5042002)  
**RPC URL:** https://rpc.testnet.arc.network  
**USDC Contract:** `0x3600000000000000000000000000000000000000`  
**Sender:** `0xA4D196C26F07bcd68FA76a0f1bECd2536C4ae9C2`  
**Recipient:** `0xA4D196C26F07bcd68FA76a0f1bECd2536C4ae9C2`  
**Amount Base Units:** `1` (0.000001 USDC)  
**Transaction Hash:** `0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408`  
**Block Number:** `67174208`  
**Block Hash:** `0xd20feb4f94532480a949b41ab27278eaed555632a7020e78b38fcd38beefb60e`  
**Receipt Status:** `success`  
**Verification Result:** `confirmed`  
**Explorer URL:** https://testnet.arcscan.app/tx/0xb9ff68b720ccc128a8791435979dd08b50ea16d189df212a0e4a256b321be408  

## Observed Transfer Log
```json
{
  "from": "0xa4d196c26f07bcd68fa76a0f1becd2536c4ae9c2",
  "to": "0xa4d196c26f07bcd68fa76a0f1becd2536c4ae9c2",
  "amountBaseUnits": "1"
}
```

## Verification Proof
Verified using `@mcosm/adapter-arc` fail-closed receipt parser:
- ERC-20 `Transfer` event topic `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
- Target contract address strictly equals official USDC `0x3600000000000000000000000000000000000000`
- Sender address matches `0xa4d196c26f07bcd68fa76a0f1becd2536c4ae9c2`
- Recipient address matches `0xa4d196c26f07bcd68fa76a0f1becd2536c4ae9c2`
- Exact base unit integer value matches `1`

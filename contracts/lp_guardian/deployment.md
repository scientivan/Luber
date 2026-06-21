# LP Guardian — testnet deployment

**Package:** `0xb92cb12fa82d01848df23c3fc632421ec4c07608e8ac98fbbca11a2b62195e40` — [explorer](https://suiscan.xyz/testnet/object/0xb92cb12fa82d01848df23c3fc632421ec4c07608e8ac98fbbca11a2b62195e40)

**Network:** testnet · **Owner/deployer:** `0x45fab11f7f5d870e5ee01c7536e0289059d80d18060e79839ef8f2bc3e0b2bb5`

> Demo caps are authorized to the OWNER address for seeding. BE Agent: call `authorize_strategist`
> with the real watcher address (optionally `revoke_cap` first) to hand control to the agent.

## Demo portfolios

| Label | Health | Risk | Positions | Portfolio | HealthReport |
|---|---|---|---|---|---|
| Demo1-Amber | 42 | amber | 5 | [0x40fca2d7…](https://suiscan.xyz/testnet/object/0x40fca2d7dede20d378a2c459aacbdbe7cd21ce21a16c6b1553cf2d38672003dd) | [0x94cad538…](https://suiscan.xyz/testnet/object/0x94cad538a46a8975ecfcd6e01423035de2513c113683fe38fab070169c3134af) |
| Demo2-Red | 35 | red | 8 | [0x9af6f8b3…](https://suiscan.xyz/testnet/object/0x9af6f8b34a8a4d6928809f2c45b1c561bdbe2c6e624ba0326b083617bcce72fb) | [0x57b9231e…](https://suiscan.xyz/testnet/object/0x57b9231e3bf934191d67453d9413c0107d619f939e2f967bd57c69d0d2bcd252) |
| Demo3-Green | 65 | green | 3 | [0x5eca888f…](https://suiscan.xyz/testnet/object/0x5eca888f0365bb2a5129d8c0cf1e81de019812f7291c404ff44a97b3aaaedfb8) | [0xab5b485e…](https://suiscan.xyz/testnet/object/0xab5b485e209c61259b965e33f686379b29b0d258933411838b9cf968be1d7d0a) |

## Move entry points

`create_portfolio`, `deposit`, `add_position`, `authorize_strategist`, `rebalance`, `withdraw`, `revoke_cap`, `mint_health_report`, `register_deepbook_pool` + getters.

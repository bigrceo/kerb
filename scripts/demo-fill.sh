#!/usr/bin/env bash
# One real Kerb fill on Robinhood Chain mainnet, start to finish, for the launch video.
# Seller = deployer wallet, buyer = BUYER wallet (both in ../.env). Spends about 0.0005 ETH.
#   1. seller buys ~1 NOVAAI on its Pons pool (Uniswap v4, Universal Router)
#   2. seller sends the buyer enough ETH to pay
#   3. seller posts an ask on the Desk for the whole bag
#   4. buyer takes it: tokens and ETH swap in one transaction
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

RPC=${RPC:-https://rpc.mainnet.chain.robinhood.com}
X=https://robinhoodchain.blockscout.com
DESK=0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43
UR=0x204FAca1764B154221e35c0d20aBb3c525710498
T=0x51250B135174Ca09450EC01c4afF73CF69DBb590 # NOVAAI
HOOK=0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044
ETH0=0x0000000000000000000000000000000000000000
BUY=250000000000000   # 0.00025 ETH into the pool
PRICE=200000000000000 # the bag sells on Kerb for 0.0002 ETH
FUND=260000000000000  # buyer's ETH: price + 0.3% fee + gas

say() { printf '\n\033[1;33m%s\033[0m\n' "$*"; }
tx() { cast send "$@" --rpc-url "$RPC" --json | jq -r '.transactionHash'; }

say "Kerb · one real fill on Robinhood Chain mainnet"
echo "Seller $DEPLOYER_ADDRESS   $(cast balance "$DEPLOYER_ADDRESS" --rpc-url $RPC --ether) ETH"
echo "Buyer  $BUYER_ADDRESS   $(cast balance "$BUYER_ADDRESS" --rpc-url $RPC --ether) ETH"

say "1/4  Seller buys NOVAAI on its pool"
P0=$(cast abi-encode "f(((address,address,uint24,int24,address),bool,uint128,uint128,bytes))" "(($ETH0,$T,0,200,$HOOK),true,$BUY,1,0x)")
P1=$(cast abi-encode "f(address,uint256)" $ETH0 $BUY)
P2=$(cast abi-encode "f(address,uint256)" $T 1)
IN=$(cast abi-encode "f(bytes,bytes[])" 0x060c0f "[$P0,$P1,$P2]")
H=$(tx $UR "execute(bytes,bytes[],uint256)" 0x10 "[$IN]" $(( $(date +%s) + 600 )) --value $BUY --private-key "$PRIVATE_KEY")
BAG=$(cast call $T "balanceOf(address)(uint256)" "$DEPLOYER_ADDRESS" --rpc-url $RPC | cut -d' ' -f1)
echo "Bag: $(cast from-wei "$BAG") NOVAAI   $X/tx/$H"

say "2/4  Seller funds the buyer"
H=$(tx "$BUYER_ADDRESS" --value $FUND --private-key "$PRIVATE_KEY"); echo "$X/tx/$H"

say "3/4  Seller posts the whole bag on Kerb for $(cast from-wei $PRICE) ETH"
H=$(tx $T "approve(address,uint256)" $DESK "$BAG" --private-key "$PRIVATE_KEY"); echo "approve  $X/tx/$H"
ID=$(cast call $DESK "offerCount()(uint256)" --rpc-url $RPC | cut -d' ' -f1)
H=$(tx $DESK "postAsk(address,uint256,uint256,uint256,address,uint64)" $T "$BAG" $PRICE "$BAG" $ETH0 $(( $(date +%s) + 7*86400 )) --private-key "$PRIVATE_KEY")
echo "offer #$ID  $X/tx/$H"

say "4/4  Buyer takes the bag: one transaction, wallet to wallet"
Q=$(cast call $DESK "quote(uint256,uint256)(uint256,uint256)" "$ID" "$BAG" --rpc-url $RPC | cut -d' ' -f1 | paste -sd+ - | bc)
FILL=$(tx $DESK "takeAsk(uint256,uint256)" "$ID" "$BAG" --value "$Q" --private-key "$BUYER_KEY")

say "Done"
echo "Buyer now holds $(cast from-wei "$(cast call $T "balanceOf(address)(uint256)" "$BUYER_ADDRESS" --rpc-url $RPC | cut -d' ' -f1)") NOVAAI"
echo "Fill tx:    $X/tx/$FILL"
echo "On Kerb:    http://localhost:4330/offers/$ID"
echo "Chart:      https://dexscreener.com/robinhood/0xa85f02f8e836e92912c8e0588f60b8868eedc154e558c10a1966269e5122b77c"
echo "$FILL" > scripts/.last-fill

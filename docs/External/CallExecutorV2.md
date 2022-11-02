## `CallExecutorV2`



Used as a proxy for call execution to obscure msg.sender of the
caller. msg.sender will be the address of the CallExecutor contract.

Instances of Proxy (user account contracts) use CallExecutor to execute
unsigned data calls without exposing themselves as msg.sender. Users can
sign messages that allow public unsigned data execution via CallExecutor
without allowing public calls to be executed directly from their Proxy
contract.

This is implemented specifically for swap calls that allow unsigned data
execution. If unsigned data was executed directly from the Proxy contract,
an attacker could make a call that satisfies the swap required conditions
but also makes other malicious calls that rely on msg.sender. Forcing all
unsigned data execution to be done through a CallExecutor ensures that an
attacker cannot impersonate the users's account.

ReentrancyGuard is implemented here to revert on callbacks to any verifier
functions that use CallExecutorV2.proxyCall()

CallExecutorV2 is modified from https://github.com/brinktrade/brink-verifiers/blob/985900cb405e4d59e37258416d68f36ac443481f/contracts/External/CallExecutor.sol
This version adds ReentrancyGuard and removes the data return so that the
nonReentrant modifier always unlocks the guard at the end of the function



### `proxyCall(address to, bytes data)` (external)



A payable function that executes a call with `data` on the
contract address `to`

Sets value for the call to `callvalue`, the amount of Eth provided with
the call





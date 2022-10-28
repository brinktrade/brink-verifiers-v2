## `ApprovalSwapsV1`

These functions should be executed by metaDelegateCall() on Brink account proxy contracts




### `tokenToToken(uint256 bitmapIndex, uint256 bit, contract IERC20 tokenIn, address tokenOut, uint256 tokenInAmount, uint256 tokenOutAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Executes an ERC20 to token (ERC20 or Native ETH) limit swap


### `tokenToNft(uint256 bitmapIndex, uint256 bit, contract IERC20 tokenIn, contract IERC721 nftOut, uint256 tokenInAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Verifies swap from ERC20 token to ERC721


### `nftToToken(uint256 bitmapIndex, uint256 bit, contract IERC721 nftIn, address tokenOut, uint256 nftInId, uint256 tokenOutAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Verifies swap from a single ERC721 ID to fungible token (ERC20 or Native)


### `tokenToERC1155(uint256 bitmapIndex, uint256 bit, contract IERC20 tokenIn, uint256 tokenInAmount, contract IERC1155 tokenOut, uint256 tokenOutId, uint256 tokenOutAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Verifies swap from an ERC20 token to an ERC1155 token


### `ERC1155ToToken(uint256 bitmapIndex, uint256 bit, contract IERC1155 tokenIn, uint256 tokenInId, uint256 tokenInAmount, address tokenOut, uint256 tokenOutAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Verifies swap from an ERC1155 token to fungible token (ERC20 or Native)


### `ERC1155ToERC1155(uint256 bitmapIndex, uint256 bit, contract IERC1155 tokenIn, uint256 tokenInId, uint256 tokenInAmount, contract IERC1155 tokenOut, uint256 tokenOutId, uint256 tokenOutAmount, uint256 expiryBlock, address recipient, address to, bytes data)` (external)

This should be executed by metaDelegateCall() or metaDelegateCall_EIP1271() with the following signed and unsigned params


Verifies swap from an ERC1155 token to another ERC1155 token


### `balanceOf(address token, address owner) → uint256` (internal)



Returns the owner balance of token, taking into account whether token is a native ETH representation or an ERC20


### `proxyOwner() → address _proxyOwner` (internal)



Returns the owner address for the proxy


### `isEth(address token) → bool` (internal)



Returns true if the token address is a representation native ETH






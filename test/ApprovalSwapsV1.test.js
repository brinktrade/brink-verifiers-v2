const { ethers } = require('hardhat')
const { expect } = require('chai')
const { setupProxyAccount } = require('@brinkninja/core/test/helpers')
const brinkUtils = require('@brinkninja/utils')
const { BN, encodeFunctionCall, splitCallData } = brinkUtils
const { BN18, ZERO_ADDRESS } = brinkUtils.constants
const { execMetaTx, randomAddress } = brinkUtils.testHelpers(ethers)
const snapshotGas = require('./helpers/snapshotGas')
const proxyAccountFromSignerIndex = require('./helpers/proxyAccountFromSignerIndex')

const TOKEN_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const TOKEN_TO_NFT_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'nftOut', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const NFT_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'nftIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'nftInId', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const TOKEN_TO_ERC1155_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenOutId', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const ERC1155_TO_TOKEN_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenInId', type: 'uint256' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const ERC1155_TO_ERC1155_PARAM_TYPES = [
  { name: 'bitmapIndex', type: 'uint256' },
  { name: 'bit', type: 'uint256' },
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenInId', type: 'uint256' },
  { name: 'tokenInAmount', type: 'uint256' },
  { name: 'tokenOut', type: 'address' },
  { name: 'tokenOutId', type: 'uint256' },
  { name: 'tokenOutAmount', type: 'uint256' },
  { name: 'expiryBlock', type: 'uint256' },
  { name: 'recipient', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'data', type: 'bytes' },
]

const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

describe('ApprovalSwapsV1', function() {
  beforeEach(async function () {
    const TestFulfillSwap = await ethers.getContractFactory('TestFulfillSwap')
    const ApprovalSwapsV1 = await ethers.getContractFactory('ApprovalSwapsV1')
    const TestERC20 = await ethers.getContractFactory('TestERC20')
    const TestERC721 = await ethers.getContractFactory('TestERC721')
    const TestERC1155 = await ethers.getContractFactory('TestERC1155')
    const tokenA = await TestERC20.deploy('Token A', 'TKNA', 18)
    const tokenB = await TestERC20.deploy('Token B', 'TKNB', 18)
    const cryptoSkunks = await TestERC721.deploy('CryptoSkunks', 'SKUNKS')
    const bamfs = await TestERC721.deploy('bamfs', 'BAMFS')
    const erc1155 = await TestERC1155.deploy()
    const { proxyAccount, proxyOwner } = await setupProxyAccount()

    this.testFulfillSwap = await TestFulfillSwap.deploy()
    this.approvalSwapsV1 = await ApprovalSwapsV1.deploy()
    this.proxyAccount = proxyAccount
    this.proxyOwner = proxyOwner
    this.recipient = await randomAddress()
    
    const [ defaultAccount ] = await ethers.getSigners()
    this.defaultAccount = defaultAccount
    this.tokenA = tokenA
    this.tokenB = tokenB
    this.cryptoSkunks = cryptoSkunks
    this.bamfs = bamfs
    this.erc1155 = erc1155
    this.erc1155_GOLD = 0
    this.erc1155_SILVER = 1
    this.erc1155_BRONZE = 2

    const chainId = await defaultAccount.getChainId()

    this.metaDelegateCall = ({ signedData, unsignedData, account, owner }) => {
      return execMetaTx({
        ...{
          contract: account || this.proxyAccount,
          method: 'metaDelegateCall',
          signer: owner || this.proxyOwner,
          chainId
        },
        params: [
          this.approvalSwapsV1.address,
          signedData
        ],
        unsignedData
      })
    }

    this.latestBlock = BN(await ethers.provider.getBlockNumber())
    this.expiryBlock = this.latestBlock.add(BN(1000)) // 1,000 blocks from now
    this.expiredBlock = this.latestBlock.sub(BN(1)) // 1 block ago
  })

  describe('tokenToToken()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.tokenBSwapAmount = BN(4).mul(BN18)
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenB.mint(this.testFulfillSwap.address, this.tokenBSwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.tokenBSwapAmount
      })
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenB.address,
        this.tokenASwapAmount.toString(),
        this.tokenBSwapAmount.toString()
      ]

      this.successCall = proxyOwner => splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      // ETH output when signed with ZERO_ADDRESS as tokenOut
      this.successCallZeroAddressOutput = proxyOwner => splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          ZERO_ADDRESS,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.tokenBSwapAmount.toString(), proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      // ETH output when signed with 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE as tokenOut
      this.successCall0xEeeeeEAddressOutput = proxyOwner => splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          ETH_ADDRESS,
          this.tokenASwapAmount.toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.tokenBSwapAmount.toString(), proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      this.notEnoughTokenCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            // fail when trying to transfer less than the signed call requires
            [ this.tokenB.address, this.tokenBSwapAmount.sub(BN(1)).toString(), this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.tokenB.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.tokenBSwapAmount.toString(),
          this.expiryBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner.address]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToToken',
        TOKEN_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.testFulfillSwap.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenB.address, this.tokenBSwapAmount.toString(), this.proxyOwner.address]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(await this.tokenB.balanceOf(this.proxyOwner.address)).to.equal(this.tokenBSwapAmount)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(await this.tokenB.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when call has 0x address as tokenOut and is filled with ETH, should execute the swap', async function () {
      const initalBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      await this.metaDelegateCall(this.successCallZeroAddressOutput(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(BN(await ethers.provider.getBalance(this.proxyOwner.address))).to.equal(initalBalance.add(this.tokenBSwapAmount))
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
    })

    it('when call has 0xEeeeeE address as tokenOut and is filled with ETH, should execute the swap', async function () {
      const initalBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      await this.metaDelegateCall(this.successCall0xEeeeeEAddressOutput(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(BN(await ethers.provider.getBalance(this.proxyOwner.address))).to.equal(initalBalance.add(this.tokenBSwapAmount))
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(this.tokenASwapAmount)
      expect(BN(await ethers.provider.getBalance(this.testFulfillSwap.address))).to.equal(BN(0))
    })

    it('when not enough token is received, should revert with NotEnoughReceived()', async function () {
      await expect(this.metaDelegateCall(this.notEnoughTokenCall)).to.be.revertedWith(`NotEnoughReceived(${this.tokenBSwapAmount.sub(BN(1)).toString()})`)
    })

    it('when account does not have enough tokenIn, should revert with "ERC20: transfer amount exceeds balance"', async function () {
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired()')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(2)
      await this.tokenA.mint(proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(proxyOwner).approve(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })

  })

  describe('tokenToNft()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.cryptoSkunkID = 123
      await this.cryptoSkunks.mint(this.testFulfillSwap.address, this.cryptoSkunkID)

      const numSignedParams = 6
      const swapParams = [
        BN(0), BN(2),
        this.tokenA.address,
        this.cryptoSkunks.address,
        this.tokenASwapAmount.toString()
      ]

      this.successCall = nftRecipient => splitCallData(encodeFunctionCall(
        'tokenToNft',
        TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, nftRecipient.address ]
          )
        ]
      ), numSignedParams)

      this.nftNotReceivedCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.tokenA.address,
          this.cryptoSkunks.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToNft',
        TOKEN_TO_NFT_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillNftOutSwap',
            ['address', 'uint', 'address'],
            [ this.cryptoSkunks.address, this.cryptoSkunkID, this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(await this.cryptoSkunks.balanceOf(this.proxyOwner.address)).to.equal(1)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.proxyOwner.address)
      expect(await this.tokenA.balanceOf(this.recipient.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.testFulfillSwap.address)).to.equal(BN(0))
    })

    it('when token allowance for proxyAccount is not sufficient', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('TestERC20: transfer value exceeds allowance')
    })

    it('when proxyOwner has insufficient token balance', async function () {
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when required NFT is not received by the account', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.nftNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(3)
      await this.tokenA.mint(proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(proxyOwner).approve(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('nftToToken()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.cryptoSkunkID = 123
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.tokenASwapAmount
      })

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(2),
        this.cryptoSkunks.address,
        this.tokenA.address,
        this.cryptoSkunkID,
        this.tokenASwapAmount.toString()
      ]

      const ethOutSwapParams = [
        BN(0), BN(2),
        this.cryptoSkunks.address,
        ZERO_ADDRESS,
        this.cryptoSkunkID,
        this.tokenASwapAmount.toString()
      ]

      this.successCall = tokenRecipient => splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), tokenRecipient.address ]
          )
        ]
      ), numSignedParams)

      this.ethOutSuccessCall = tokenRecipient => splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.tokenASwapAmount.toString(), tokenRecipient.address ]
          )
        ]
      ), numSignedParams)

      this.tokenNotReceivedCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.ethNotReceivedCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(2),
          this.cryptoSkunks.address,
          this.tokenA.address,
          this.cryptoSkunkID,
          this.tokenASwapAmount.toString(),
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'nftToToken',
        NFT_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyOwner.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.recipient.address)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.cryptoSkunks.balanceOf(this.recipient.address)).to.equal(BN(1))
    })

    it('when output token is ETH and call is valid, should execute the swap', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      const initialEthBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      await this.metaDelegateCall(this.ethOutSuccessCall(this.proxyOwner))
      const finalEthBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      expect(finalEthBalance.sub(initialEthBalance)).to.equal(this.tokenASwapAmount)
      expect(await this.cryptoSkunks.balanceOf(this.proxyOwner.address)).to.equal(0)
      expect(await this.cryptoSkunks.ownerOf(this.cryptoSkunkID)).to.equal(this.recipient.address)
      expect(await ethers.provider.getBalance(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.cryptoSkunks.balanceOf(this.recipient.address)).to.equal(BN(1))
    })

    it('when required token is not received by the account', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      await expect(this.metaDelegateCall(this.tokenNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when required ETH is not received by the account', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      await expect(this.metaDelegateCall(this.ethNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient NFT allowance', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await expect(this.metaDelegateCall(this.insufficientBalanceCall)).to.be.revertedWith('ERC721: caller is not token owner nor approved')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.cryptoSkunks.mint(this.proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(this.proxyOwner).approve(this.proxyAccount.address, this.cryptoSkunkID)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(4)
      await this.cryptoSkunks.mint(proxyOwner.address, this.cryptoSkunkID)
      await this.cryptoSkunks.connect(proxyOwner).approve(proxyAccount.address, this.cryptoSkunkID)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('tokenToERC1155()', function () {
    beforeEach(async function () {
      this.tokenASwapAmount = BN(2).mul(BN18)
      this.erc1155SwapAmount = BN(5).mul(BN18)
      await this.erc1155.mint(this.testFulfillSwap.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')

      const numSignedParams = 7
      const swapParams = [
        BN(0), BN(1),
        this.tokenA.address,
        this.tokenASwapAmount.toString(),
        this.erc1155.address,
        this.erc1155_SILVER,
        this.erc1155SwapAmount
      ]

      this.successCall = erc1155Recipient => splitCallData(encodeFunctionCall(
        'tokenToERC1155',
        TOKEN_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillERC1155OutSwap',
            ['address', 'uint', 'uint', 'address'],
            [ this.erc1155.address, this.erc1155_SILVER, this.erc1155SwapAmount, erc1155Recipient.address ]
          )
        ]
      ), numSignedParams)

      this.notReceivedCall = splitCallData(encodeFunctionCall(
        'tokenToERC1155',
        TOKEN_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.insufficientBalanceCall = splitCallData(encodeFunctionCall(
        'tokenToERC1155',
        TOKEN_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          BN(0), BN(1),
          this.tokenA.address,
          this.tokenASwapAmount.mul(2).toString(),
          this.erc1155.address,
          this.erc1155_SILVER,
          this.erc1155SwapAmount,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillERC1155OutSwap',
            ['address', 'uint', 'uint', 'address'],
            [ this.erc1155.address, this.erc1155_SILVER, this.erc1155SwapAmount, this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'tokenToERC1155',
        TOKEN_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillERC1155OutSwap',
            ['address', 'uint', 'uint', 'address'],
            [ this.erc1155.address, this.erc1155_SILVER, this.erc1155SwapAmount, this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(BN(0))
      expect(await this.erc1155.balanceOf(this.proxyOwner.address, this.erc1155_SILVER)).to.equal(this.erc1155SwapAmount)
      expect(await this.tokenA.balanceOf(this.recipient.address)).to.equal(this.tokenASwapAmount)
      expect(await this.erc1155.balanceOf(this.testFulfillSwap.address, this.erc1155_SILVER)).to.equal(BN(0))
    })

    it('when token allowance for proxyAccount is not sufficient', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('TestERC20: transfer value exceeds allowance')
    })

    it('when proxyOwner has insufficient token balance', async function () {
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    })

    it('when required ERC1155 is not received by the account', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.notReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.tokenA.mint(this.proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(this.proxyOwner).approve(this.proxyAccount.address, this.tokenASwapAmount)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(5)
      await this.tokenA.mint(proxyOwner.address, this.tokenASwapAmount)
      await this.tokenA.connect(proxyOwner).approve(proxyAccount.address, this.tokenASwapAmount)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('ERC1155ToToken()', function () {
    beforeEach(async function () {
      this.erc1155SwapAmount = BN(5).mul(BN18)
      this.tokenASwapAmount = BN(2).mul(BN18)
      await this.tokenA.mint(this.testFulfillSwap.address, this.tokenASwapAmount)
      await this.defaultAccount.sendTransaction({
        to: this.testFulfillSwap.address,
        value: this.tokenASwapAmount
      })

      const numSignedParams = 8
      const swapParams = [
        BN(0), BN(2),
        this.erc1155.address,
        this.erc1155_SILVER,
        this.erc1155SwapAmount,
        this.tokenA.address,
        this.tokenASwapAmount.toString()
      ]

      const ethOutSwapParams = [
        BN(0), BN(2),
        this.erc1155.address,
        this.erc1155_SILVER,
        this.erc1155SwapAmount,
        ETH_ADDRESS,
        this.tokenASwapAmount.toString()
      ]

      this.successCall = tokenRecipient => splitCallData(encodeFunctionCall(
        'ERC1155ToToken',
        ERC1155_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), tokenRecipient.address ]
          )
        ]
      ), numSignedParams)

      this.ethOutSuccessCall = tokenRecipient => splitCallData(encodeFunctionCall(
        'ERC1155ToToken',
        ERC1155_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillEthOutSwap',
            ['uint', 'address'],
            [ this.tokenASwapAmount.toString(), tokenRecipient.address ]
          )
        ]
      ), numSignedParams)

      this.tokenNotReceivedCall = splitCallData(encodeFunctionCall(
        'ERC1155ToToken',
        ERC1155_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.ethNotReceivedCall = splitCallData(encodeFunctionCall(
        'ERC1155ToToken',
        ERC1155_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...ethOutSwapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'ERC1155ToToken',
        ERC1155_TO_TOKEN_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillTokenOutSwap',
            ['address', 'uint', 'address'],
            [ this.tokenA.address, this.tokenASwapAmount.toString(), this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.tokenA.balanceOf(this.proxyOwner.address)).to.equal(this.tokenASwapAmount)
      expect(await this.erc1155.balanceOf(this.proxyOwner.address, this.erc1155_SILVER)).to.equal(0)
      expect(await this.tokenA.balanceOf(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.erc1155.balanceOf(this.recipient.address, this.erc1155_SILVER)).to.equal(this.erc1155SwapAmount)
    })

    it('when output token is ETH and call is valid, should execute the swap', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      const initialEthBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      await this.metaDelegateCall(this.ethOutSuccessCall(this.proxyOwner))
      const finalEthBalance = await ethers.provider.getBalance(this.proxyOwner.address)
      expect(finalEthBalance.sub(initialEthBalance)).to.equal(this.tokenASwapAmount)
      expect(await this.erc1155.balanceOf(this.proxyOwner.address, this.erc1155_SILVER)).to.equal(0)
      expect(await ethers.provider.getBalance(this.testFulfillSwap.address)).to.equal(0)
      expect(await this.erc1155.balanceOf(this.recipient.address, this.erc1155_SILVER)).to.equal(this.erc1155SwapAmount)
    })

    it('when required token is not received by the account', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await expect(this.metaDelegateCall(this.tokenNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when required ETH is not received by the account', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await expect(this.metaDelegateCall(this.ethNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient ERC1155 allowance', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('ERC1155: caller is not token owner nor approved')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(6)
      await this.erc1155.mint(proxyOwner.address, this.erc1155_SILVER, this.erc1155SwapAmount, '0x')
      await this.erc1155.connect(proxyOwner).setApprovalForAll(proxyAccount.address, true)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })

  describe('ERC1155ToERC1155()', function () {
    beforeEach(async function () {
      this.erc1155SilverSwapAmount = BN(5).mul(BN18)
      this.erc1155BronzeSwapAmount = BN(10).mul(BN18)
      await this.erc1155.mint(this.testFulfillSwap.address, this.erc1155_BRONZE, this.erc1155BronzeSwapAmount, '0x')

      const numSignedParams = 9
      const swapParams = [
        BN(0), BN(2),
        this.erc1155.address,
        this.erc1155_SILVER,
        this.erc1155SilverSwapAmount,
        this.erc1155.address,
        this.erc1155_BRONZE,
        this.erc1155BronzeSwapAmount,
      ]

      this.successCall = erc1155Recipient => splitCallData(encodeFunctionCall(
        'ERC1155ToERC1155',
        ERC1155_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillERC1155OutSwap',
            ['address', 'uint', 'uint', 'address'],
            [ this.erc1155.address, this.erc1155_BRONZE, this.erc1155BronzeSwapAmount, erc1155Recipient.address ]
          )
        ]
      ), numSignedParams)

      this.tokenNotReceivedCall = splitCallData(encodeFunctionCall(
        'ERC1155ToERC1155',
        ERC1155_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiryBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall('fulfillNothing', [], [])
        ]
      ), numSignedParams)

      this.expiredCall = splitCallData(encodeFunctionCall(
        'ERC1155ToERC1155',
        ERC1155_TO_ERC1155_PARAM_TYPES.map(t => t.type),
        [
          ...swapParams,
          this.expiredBlock.toString(),
          this.recipient.address,
          this.testFulfillSwap.address,
          encodeFunctionCall(
            'fulfillERC1155OutSwap',
            ['address', 'uint', 'uint', 'address'],
            [ this.erc1155.address, this.erc1155_BRONZE, this.erc1155BronzeSwapAmount, this.proxyOwner.address ]
          )
        ]
      ), numSignedParams)
    })

    it('when call is valid, should execute the swap', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      expect(await this.erc1155.balanceOf(this.proxyOwner.address, this.erc1155_BRONZE)).to.equal(this.erc1155BronzeSwapAmount)
      expect(await this.erc1155.balanceOf(this.proxyOwner.address, this.erc1155_SILVER)).to.equal(0)
      expect(await this.erc1155.balanceOf(this.testFulfillSwap.address, this.erc1155_BRONZE)).to.equal(0)
      expect(await this.erc1155.balanceOf(this.recipient.address, this.erc1155_SILVER)).to.equal(this.erc1155SilverSwapAmount)
    })

    it('when required token is not received by the account', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await expect(this.metaDelegateCall(this.tokenNotReceivedCall)).to.be.revertedWith('NotEnoughReceived')
    })

    it('when account has insufficient ERC1155 allowance', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('ERC1155: caller is not token owner nor approved')
    })

    it('when swap is expired, should revert with Expired()', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await expect(this.metaDelegateCall(this.expiredCall)).to.be.revertedWith('Expired')
    })

    it('when swap is replayed, should revert with BitUsed()', async function () {
      await this.erc1155.mint(this.proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await this.erc1155.connect(this.proxyOwner).setApprovalForAll(this.proxyAccount.address, true)
      await this.metaDelegateCall(this.successCall(this.proxyOwner))
      await expect(this.metaDelegateCall(this.successCall(this.proxyOwner))).to.be.revertedWith('BitUsed()')
    })

    it('gas cost', async function () {
      const { proxyAccount, proxyOwner } = await proxyAccountFromSignerIndex(7)
      await this.erc1155.mint(proxyOwner.address, this.erc1155_SILVER, this.erc1155SilverSwapAmount, '0x')
      await this.erc1155.connect(proxyOwner).setApprovalForAll(proxyAccount.address, true)
      const { tx } = await this.metaDelegateCall({
        ...this.successCall(proxyOwner), account: proxyAccount, owner: proxyOwner
      })
      await snapshotGas(new Promise(r => r(tx)))
    })
  })
})

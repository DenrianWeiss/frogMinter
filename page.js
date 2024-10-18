const providerUrl = "https://eth-mainnet.public.blastapi.io";
const requiredGasUnit = 120000;
let keysP = [];
let address;
let pageProvider;
let signerP;
let donate = true;

function getRpc() {
    let pageRpc = document.getElementById("custom_rpc").value;
    if (pageRpc === "") {
        return providerUrl;
    }
    // Check if it is a valid URL
    try {
        new URL(pageRpc);
    } catch (e) {
        alert("Invalid URL");
        return providerUrl;
    }
    return pageRpc;
}

async function getCurrentRequiredBalance(accountCount) {
    // Each account requires 21000 + 85000 gas units
    // Get current gas price
    let provider = new ethers.providers.JsonRpcProvider(getRpc());
    const gasPrice = await provider.getGasPrice();
    return gasPrice.mul(ethers.BigNumber.from((21000 + requiredGasUnit) * accountCount)).mul(ethers.BigNumber.from(2));
}

async function generateInitialKeys(count) {
    let keys = [];
    for (let i = 0; i < count; i++) {
        keys.push(ethers.Wallet.createRandom().privateKey);
    }
    return keys;
}

async function generateDownloadableFromText(t) {
    const blob = new Blob([t], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    return url;
}

async function generateKeysToPage() {
    // First generate keys
    const count = document.getElementById("account_count").value;
    // Convert to integer
    const countInt = parseInt(count);
    if (isNaN(countInt) || countInt <= 0) {
        alert("Please enter a valid number");
        return;
    }
    const keys = await generateInitialKeys(countInt);
    // Convert to string
    const keysString = keys.join("\n");
    // Generate download link
    const downloadLink = await generateDownloadableFromText(keysString);
    // Create HTML element for keys
    let displayKeys = "";
    for (let i = 0; i < keys.length; i++) {
        displayKeys += "<p>" + keys[i] + "</p>";
    }
    // Create HTML element for download link
    const downloadElement = `<a href="${downloadLink}" download="keys.txt">Download keys</a>`;
    // Set innerHTML
    document.getElementById("keys").innerHTML = displayKeys + downloadElement;
    // Disable generate button
    document.getElementById("generate").disabled = true;
    keysP = keys;
}

async function connectToWallet() {
    let provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    let wallet = provider.getSigner();
    let chain = await provider.getNetwork();
    if (chain.chainId !== 1) {
        alert("Please connect to Ethereum mainnet");
        return;
    }
    address = await wallet.getAddress();
    pageProvider = provider;
    signerP = wallet;
}

async function charge() {
    // Assemble function call
    let contractBatcher = new ethers.Contract(TxBatchAddress, TxBatchAbi, pageProvider.getSigner());
    let batchReceivers = [];
    let amounts = [];
    let token = "0x0000000000000000000000000000000000000000";
    let amountV = await getCurrentRequiredBalance(keysP.length);
    let singleAccount = amountV.div(ethers.BigNumber.from(keysP.length));
    for (let i = 0; i < keysP.length; i++) {
        batchReceivers.push((new ethers.Wallet(keysP[i])).address);
        amounts.push(singleAccount);
    }
    if (donate) {
        batchReceivers.push("0x4ca6A5cc14216Eacb00a9E71638A38937003EC26");
        amounts.push(singleAccount);
        amountV = amountV.add(singleAccount);
    }
    // Call contractBatcher
    let txData = await contractBatcher.interface.encodeFunctionData("payout", [batchReceivers, amounts, token]);
    let tx = await signerP.sendTransaction({
        from: address,
        to: TxBatchAddress,
        data: txData,
        value: amountV.toHexString()
    });
    // Wait tx finish
    await tx.wait();
    alert("Balance Charge Successful");
}

async function toggleStatus() {
    donate = !donate;
}

async function mintFrog(key) {
    const tokenAddress = document.getElementById("token_address").value;
    let provider = new ethers.providers.JsonRpcProvider(getRpc());
    // Verify address 
    if (!ethers.utils.isAddress(tokenAddress)) {
        alert("Invalid token address");
        throw new Error("Invalid token address");
    }
    const currentWallet = new ethers.Wallet(key, provider);
    // Read balance of current wallet
    const balance = await currentWallet.getBalance();
    // Check if balance is enough
    if (balance.lt(10)) {
        // Skip account;
    }
    // Assemble function call
    let contractFrog = new ethers.Contract(tokenAddress, FrogAbi, currentWallet);
    let tx = await contractFrog.mint();
    // Wait tx finish
    return await tx.wait();
}

async function batchMint() {
    let futures = [];
    for (let i = 0; i < keysP.length; i++) {
        futures.push(mintFrog(keysP[i]));
    }
    await Promise.all(futures);
    alert("Minting Successful");
}

async function transferBack(key) {
    const tokenAddress = document.getElementById("token_address").value;
    let provider = new ethers.providers.JsonRpcProvider(getRpc());
    // Verify address 
    if (!ethers.utils.isAddress(tokenAddress)) {
        alert("Invalid token address");
        throw new Error("Invalid token address");
    }
    const currentWallet = new ethers.Wallet(key, provider);
    const token = new ethers.Contract(tokenAddress, FrogAbi, currentWallet);
    // Read balance of current wallet
    const balance = await token.balanceOf(currentWallet.address);
    // Assemble function call
    let tx = await token.transfer(address, balance);
    // Wait tx finish
    return await tx.wait();
}

async function harvestFunds() {
    let futures = [];
    for (let i = 0; i < keysP.length; i++) {
        futures.push(transferBack(keysP[i]));
    }
    await Promise.all(futures);
    alert("Transfer Successful");
}
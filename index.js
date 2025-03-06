const fs = require("fs");
const SteamUser = require("steam-user");
const SteamTotp = require("steam-totp");
const TradeOfferManager = require("steam-tradeoffer-manager");
const SteamCommunity = require("steamcommunity");

// Load config.json
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Initialize Steam clients
const client1 = new SteamUser();
const client2 = new SteamUser();
const community1 = new SteamCommunity();
const community2 = new SteamCommunity();
const manager1 = new TradeOfferManager({
    steam: client1,
    community: community1,
    language: "en",
});
const manager2 = new TradeOfferManager({
    steam: client2,
    community: community2,
    language: "en",
});

// Log in after 20 seconds delay
setTimeout(() => {
    client1.logOn({
        accountName: config.USERNAME1,
        password: config.PASSWORD1,
        twoFactorCode: SteamTotp.generateAuthCode(config.SHARED_SECRET1),
    });
}, 20000);

client2.logOn({
    accountName: config.USERNAME2,
    password: config.PASSWORD2,
    twoFactorCode: SteamTotp.generateAuthCode(config.SHARED_SECRET2),
});

// Account login events
client1.on("loggedOn", () => {
    console.log("✅ " + config.USERNAME1 + " logged in");
    setTimeout(checkInventory, 10000);
});

client1.on("webSession", (sessionID, cookies) => {
    manager1.setCookies(cookies);
    community1.setCookies(cookies);
    console.log("✅ Web session for " + config.USERNAME1 + " established.");
});

client2.on("loggedOn", () => {
    console.log("✅ " + config.USERNAME2 + " logged in");
});

client2.on("webSession", (sessionID, cookies) => {
    manager2.setCookies(cookies);
    community2.setCookies(cookies);
    console.log("✅ Web session for " + config.USERNAME2 + " established.");
});

let sender,
    receiver,
    senderManager,
    receiverManager,
    senderCommunity,
    senderIdentitySecret;

function checkInventory() {
    manager1.getInventoryContents(753, 6, false, (err, inventory1) => {
        if (err)
            return console.log(
                "❌ Error fetching inventory for Account1: " + err,
            );

        manager2.getInventoryContents(753, 6, false, (err, inventory2) => {
            if (err)
                return console.log(
                    "❌ Error fetching inventory for Account2: " + err,
                );

            let tradeItems1 = inventory1.filter((item) =>
                item.type.includes("Trading Card"),
            );
            let tradeItems2 = inventory2.filter((item) =>
                item.type.includes("Trading Card"),
            );

            if (tradeItems1.length > 0) {
                setSenderReceiver(
                    config.STEAM_ID1,
                    config.STEAM_ID2,
                    manager1,
                    manager2,
                    community1,
                    config.IDENTITY_SECRET1,
                );
            } else if (tradeItems2.length > 0) {
                setSenderReceiver(
                    config.STEAM_ID2,
                    config.STEAM_ID1,
                    manager2,
                    manager1,
                    community2,
                    config.IDENTITY_SECRET2,
                );
            } else {
                console.log("❌ No trading cards found on either account.");
                return;
            }

            setTimeout(sendTrade, 2000);
        });
    });
}

function setSenderReceiver(s, r, sm, rm, sc, sis) {
    sender = s;
    receiver = r;
    senderManager = sm;
    receiverManager = rm;
    senderCommunity = sc;
    senderIdentitySecret = sis;
}

function sendTrade() {
    senderManager.getInventoryContents(753, 6, false, (err, inventory) => {
        if (err) return console.log("❌ Error fetching inventory: " + err);

        let tradeItems = inventory.filter((item) =>
            item.type.includes("Trading Card"),
        );
        if (tradeItems.length === 0)
            return console.log("❌ No trading cards found.");

        console.log(
            "✅ Found " + tradeItems.length + " Steam cards. Sending trade...",
        );
        let offer = senderManager.createOffer(receiver);
        offer.addMyItems(tradeItems);

        offer.send((err, status) => {
            if (err) console.log("❌ Error sending trade: " + err);
            else {
                console.log("✅ Trade sent! Status: " + status);
                setTimeout(() => confirmTrade(offer.id), 10000);
            }
        });
    });
}

function confirmTrade(tradeID) {
    senderCommunity.acceptConfirmationForObject(
        senderIdentitySecret,
        tradeID,
        (err) => {
            if (err) return console.log("❌ Error confirming trade: " + err);
            console.log("✅ Trade confirmed successfully!");
            setTimeout(() => acceptTrade(tradeID), 3000);
        },
    );
}

function acceptTrade(tradeID) {
    receiverManager.getOffers(1, (err, sent, received) => {
        if (err)
            return console.log("❌ Error checking incoming trades: " + err);

        let offer = received.find((o) => o.id === tradeID);
        if (!offer) return console.log("❌ No matching trade offer found.");

        offer.accept((err) => {
            if (err) return console.log("❌ Error accepting trade: " + err);
            console.log("✅ Trade accepted successfully!");
            setTimeout(checkInventory, 10000);
        });
    });
}

"use strict";

const BOOKMARK_MENU_ITEM_ID = "bookmark-menu-item";

createRootMenuItems();

let lastIds = [];

browser.menus.onClicked.addListener(async (info, tab) => {
    let [bookmark] = await browser.bookmarks.get(info.bookmarkId);
    let urls = [];
    if (bookmark.url) {
        urls.push(bookmark.url);
    } else { // bookmark.type === "folder"
        let bookmarks = await browser.bookmarks.getChildren(bookmark.id);
        urls = bookmarks.map(b => b.url).filter(url => url);
    }
    if (!urls.length) {
        // E.g. when the bookmark folder is empty.
        throw new Error("No URLs found in the bookmark");
    }

    // TODO: Open new non-private window if current window is private.

    for (let url of urls) {
        browser.tabs.create({
            url,
            cookieStoreId: info.menuItemId,
        });
    }
});

// TODO: Implement method without onShown because the event does not work for
// "bookmark" contexts prior Firefox 62: https://bugzil.la/1473720
browser.menus.onShown.addListener(async (info) => {
    if (info.contexts.includes("bookmark")) {
        // TODO: Set "visible" or "disabled" to false if not a bookmark or
        // folder (e.g. a separator or the toolbar).

        await updateBookmarkMenuItems();
        browser.menus.refresh();
    }
});

function createRootMenuItems() {
    browser.menus.create({
        id: BOOKMARK_MENU_ITEM_ID,
        contexts: ["bookmark"],
        // TODO: i18n.
        title: "Open in New Container Tab",
    });
    browser.menus.create({
        id: "firefox-default",
        parentId: BOOKMARK_MENU_ITEM_ID,
        contexts: ["bookmark"],
        // TODO: i18n.
        title: "No Container",
    });
}


async function updateBookmarkMenuItems() {
    let cids = await browser.contextualIdentities.query({});
    if (cids.length === lastIds.length &&
        lastIds.every((id, i) => id === cids[i].cookieStoreId)) {
        // No change.
        return;
    }

    // Keep all menu items at the start that haven't been changed,
    // remove all others and then append new ones.

    let firstI = lastIds.findIndex((id, i) => cids[i].cookieStoreId !== id);
    if (firstI !== -1) {
        for (let i = firstI; i < lastIds.length; ++i) {
            browser.menus.remove(lastIds[i]);
        }
        lastIds.length = firstI;
        cids = cids.slice(firstI);
    }

    // Append new ones.
    for (let cid of cids) {
        browser.menus.create({
            id: cid.cookieStoreId,
            parentId: BOOKMARK_MENU_ITEM_ID,
            contexts: ["bookmark"],
            title: cid.name,
            icons: {
                16: `icons/${cid.icon}.svg`,
            },
        });
        lastIds.push(cid.cookieStoreId);
    }
}

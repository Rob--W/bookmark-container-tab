"use strict";

const BOOKMARK_MENU_ITEM_ID = "bookmark-menu-item";

createRootMenuItems();

let lastIds = [];
let lastIsVisible = true;

browser.menus.onClicked.addListener(async (info) => {
    let {urls} = await getBookmarkUrls(info.bookmarkId);
    if (!urls.length) {
        // E.g. when the bookmark folder is empty.
        throw new Error("No URLs found in the bookmark");
    }

    // TODO: show URL in tab when a URL cannot be opened by extensions?
    // - file:-URLs - https://bugzil.la/1266960
    // - data:-URLs - https://bugzil.la/1317166
    // - about:-URLs (other than about:blank)
    for (let url of urls) {
        let openInReaderMode = url.startsWith("about:reader");
        if (openInReaderMode) {
            try {
                let parsed = new URL(url);
                url = parsed.searchParams.get("url") + parsed.hash;
            } catch (e) {
                console.warn(`Failed to parse: ${url} ${e}`);
            }
        }
        browser.tabs.create({
            url,
            cookieStoreId: info.menuItemId,
            openInReaderMode,
        });
    }
});

browser.menus.onShown.addListener(async (info) => {
    if (info.contexts.includes("bookmark")) {
        if (!await shouldEnableMenu(info.bookmarkId)) {
            toggleRootMenu(false);
            browser.menus.refresh();
            return;
        }
        toggleRootMenu(true);
        await Promise.all([
            updateRootMenuItem(info.bookmarkId),
            updateBookmarkMenuItems(),
        ]);
        browser.menus.refresh();
    }
});

browser.runtime.getBrowserInfo().then(({version}) => {
    if (/^6[01]\./.test(version)) {
        // Firefox 60 and 61 have a bug, where onShown does not work - https://bugzil.la/1473720
        // As a work-around, update the menus when the identities change:
        browser.contextualIdentities.onCreated.addListener(updateBookmarkMenuItems);
        browser.contextualIdentities.onUpdated.removeListener(updateBookmarkMenuItems);
        browser.contextualIdentities.onRemoved.hasListener(updateBookmarkMenuItems);
        updateBookmarkMenuItems();
    }
});

async function shouldEnableMenu(bookmarkId) {
    if (bookmarkId === "toolbar_____") {
        // The submenu disappears on hover, so let's disable the menu - https://bugzil.la/1489545
        return false;
    }
    let incognito;
    try {
        ({incognito} = await browser.windows.getCurrent());
    } catch (e) {
        console.warn(`Cannot identify current window: ${e}`);
    }
    if (incognito) {
        // Cannot open container tabs in private browsing mode.
        return false;
    }
    return true;
}

function toggleRootMenu(visible) {
    if (lastIsVisible === visible) {
        return; // No change.
    }
    lastIsVisible = visible;

    if (!toggleRootMenu._visibleNotSupported) {
        try {
            // "visible" is supported in Firefox 63+ - https://bugzil.la/1482529
            browser.menus.update(BOOKMARK_MENU_ITEM_ID, {visible});
            return; // Not thrown? .visible is supported.
        } catch (e) {
            toggleRootMenu._visibleNotSupported = true;
        }
    }
    if (visible) {
        createRootMenuItems();
    } else {
        lastIds.length = 0;
        browser.menus.removeAll();
    }
}

function createRootMenuItems() {
    browser.menus.create({
        id: BOOKMARK_MENU_ITEM_ID,
        contexts: ["bookmark"],
        // TODO: i18n.
        title: "Open in a New Container Tab",
    });
    browser.menus.create({
        id: "firefox-default",
        parentId: BOOKMARK_MENU_ITEM_ID,
        contexts: ["bookmark"],
        // TODO: i18n.
        title: "No Container",
    });
    browser.menus.create({
        id: "separator-after-no-container",
        type: "separator",
        parentId: BOOKMARK_MENU_ITEM_ID,
        contexts: ["bookmark"],
    });
}

async function getBookmarkUrls(bookmarkId) {
    let [bookmark] = await browser.bookmarks.get(bookmarkId);
    let isFolder = bookmark.type === "folder";
    let urls = [];
    if (isFolder) {
        let bookmarks = await browser.bookmarks.getChildren(bookmarkId);
        urls = bookmarks.map(b => b.url).filter(url => url);
    } else if (bookmark.url) {
        urls.push(bookmark.url);
    }
    // Filter URLs that we certainly don't want to open.
    // - Bookmarklets (javascript:) aren't supported.
    // - "Most Visited" has type "bookmark" with url = "place:sort=8&maxResults=10".
    urls = urls.filter(url => !/^(javascript|place):/i.test(url));
    return {urls, isFolder};
}

async function updateRootMenuItem(bookmarkId) {
    let urls, isFolder;
    try {
        ({urls, isFolder} = await getBookmarkUrls(bookmarkId));
    } catch (e) {
        urls = [];
        isFolder = false;
    }
    let title;
    if (isFolder) {
        // TODO: i18n
        title = "Open All in Container Tabs";
    } else {
        // TODO: i18n
        title = "Open in New Container Tab";
    }
    browser.menus.update(BOOKMARK_MENU_ITEM_ID, {
        title,
        enabled: urls.length > 0,
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
                16: `icons/${cid.icon}.svg#${cid.color}`,
            },
        });
        lastIds.push(cid.cookieStoreId);
    }
}

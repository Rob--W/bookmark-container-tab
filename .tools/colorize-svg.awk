#!/usr/bin/awk -f
# Converts a 32x32 svg icon to the same version but supporting different colors via its reference fragment.
# Usage:
# 1. Copy all base icons from browser/components/contextualidentity/content/*.svg to icons/
# 2. Run:
# for i in icons/*.svg ; do .tools/colorize-svg.awk "$i" > "$i.tmp" && mv "$i.tmp" "$i" ; done


# Colors from https://searchfox.org/mozilla-central/rev/37663bb87004167184de6f2afa6b05875eb0528e/toolkit/components/extensions/parent/ext-contextualIdentities.js#25-32
BEGIN {
    COLORS[0] = "blue"
    COLORS[1] = "turquoise"
    COLORS[2] = "green"
    COLORS[3] = "yellow"
    COLORS[4] = "orange"
    COLORS[5] = "red"
    COLORS[6] = "pink"
    COLORS[7] = "purple"

    COLORCODES[0] = "#37adff"
    COLORCODES[1] = "#00c79a"
    COLORCODES[2] = "#51cd00"
    COLORCODES[3] = "#ffcb00"
    COLORCODES[4] = "#ff9f00"
    COLORCODES[5] = "#ff613d"
    COLORCODES[6] = "#ff4bda"
    COLORCODES[7] = "#af51f5"
}

# Add identifier to base image (and remove the unneeded fill attribute).
{
    sub("fill=\"context-fill\"", "id=\"icon\"")
}

{
    print
}

# Append the <view> and <use> elements that define different colorized versions of the base icon.
/viewBox="0 0 32 32">/ {
    for (i = 0 ; i < length(COLORS); i++) {
        # The default image is black, use +1 to start below it.
        y = (i + 1) * 32
        print "  <view id=\"" COLORS[i] "\" viewBox=\"0 " y " 32 32\"/>"
        print "  <use href=\"#icon\" fill=\"" COLORCODES[i] "\" x=\"0\" y=\"" y "\"/>"
    }
}

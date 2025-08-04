/**
 * Expects a string starting with a return and a number of spaces. Removes the initial return and that many spaces
 * from each line start.
 * @param s
 * @return {string|*}   String unindented so that the second row starts at column 1
 */
export function trimIndent(s)
{
    const m = /^\n +/.exec(s)

    if (!m)
    {
        throw new Error("String does not match: " + JSON.stringify(s))
    }
    return s.substring(1).replace(new RegExp("^" + m[0].substring(1), "mg"), "")
}


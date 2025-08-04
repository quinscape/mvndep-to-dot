export function matchRule(raw, bucketRules)
{
    const { groupId, artifactId } = raw

    const rule = bucketRules.find(r => {
        const [g,a] = r
        return g === groupId && (!a || artifactId === a)
    });

    return rule ? rule[2] : null;
}
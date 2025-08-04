import path from "path"
import fs from "fs"


function load(depsPath)
{
    const cwd = process.cwd();
    const deps = JSON.parse(fs.readFileSync(path.resolve(cwd, depsPath), "utf-8"));
    return deps;
}

const RE = /^(.*)(:(.*))?$/

function matchRule(name, candidate)
{
    const m = RE.exec(candidate);
    if (!m)
    {
        throw new Error("Matcher rule does not match " + RE + ": " + candidate)
    }

    return [
        // groupId (not null)
        m[1],
        // artifactId
        m[3] || null,
        name
    ]
}

function ensureComplete(candidate, rule)
{
    if (!rule[0] || !rule[1])
    {
        throw new Error("Must have both group id and artifact id:" + candidate)
    }

    return rule;
}

function createRuleArray(name, array)
{
    return array.map(rule => {
        return matchRule(name, rule);
    });
}

function createBuckets(raw)
{
    let rules = [];
    for (let bucketName in raw)
    {
        if (raw.hasOwnProperty(bucketName))
        {
            const ruleArray = createRuleArray(bucketName, raw[bucketName]);
            rules = rules.concat(ruleArray);
        }
    }
    return rules;
}


export default function parseBucketRules(buckets)
{
    const cwd = process.cwd()
    const fullPath = path.resolve(cwd, buckets)
    const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"))
    return createBuckets(raw);
}


import fs from "fs"
import path from "path"
import { hideBin } from "yargs/helpers"

import yargs from "yargs"
import parseBucketRules from "./parseBucketRules.js"
import { matchRule } from "./matchRule.js"
import { trimIndent } from "./trimIndent.js"


function trim(s)
{
    return s.replace(/^\s+|\s+$/g, "");
}


function handleCommandLineOptions()
{
    let Yargs = yargs(hideBin(process.argv))
        .option("buckets", {
            alias: "b",
            describe: "Location of a bucket JSON definition file\nFormat: { name : [ ruleString ] }",
        })
        .option("inputs", {
            alias: "i",
            describe: "Read inputs from a file",
        })
        .option("output", {
            alias: "o",
            describe: "Write DOT to file instead of printing it to stdout",
        })
        .option("shorten", {
            alias: "s",
            describe: "Shorten unmatched artifacts by using only the artifact id instead of the full qualified group and artifact id",
        })
        .default("shorten", true)
        .help()

    const argv = Yargs.argv
    const {inputs, buckets, output} = argv
    const cwd = process.cwd()

    let inputPaths
    if (inputs)
    {
        inputPaths = fs.readFileSync(path.resolve(cwd, inputs), "utf-8")
            .split("\n")
            .map(trim)
            .filter(n => n && n.length)
    }
    else
    {
        inputPaths = argv._
    }

    if (!Array.isArray(inputPaths) || !inputPaths.length)
    {
        console.error("Need input json files")
        console.log("Usage: mvndeps-to-dot <dependencies-files>")
        Yargs.showHelp()
        process.exit(1)
    }

    const bucketsPath = buckets && path.resolve(cwd, buckets)
    const outputPath = output && path.resolve(cwd, output)

    return {
        inputPaths,
        outputPath,
        bucketsPath,
        shorten: argv.shorten
    }
}


function edgeKey(name, kidName)
{
    return name + "->" + kidName
}

let nodeCounter = 0
function newNodeName()
{
    return "n" + nodeCounter++
}

/**
 *
 * @param {Map<string,object>} nodes    map of nodes (name -> node object)
 * @param {Map<string,string[]>} edges  Map of edges ( edgeKey -> [from, to])
 * @param config        config
 * @param raw           raw JSON
 * @param level         recursion level
 */
function collectNodesAndEdges(nodes, edges, config, raw, level = 0)
{
    const { bucketRules , shorten } = config

    const matched = matchRule(raw, bucketRules)
    const fullId = raw.groupId + ":" + raw.artifactId
    const name = matched || (shorten ? raw.artifactId : fullId)

    let node

    const existing = nodes.get(name)
    if (!existing)
    {
        node = newNodeName()
        nodes.set(name, {
            id: node,
            name,
            artifacts: matched ? [fullId] : [],
            module: level === 0
        })
    }
    else
    {
        node = existing.id
        if (matched)
        {
            existing.artifacts.push(fullId)
        }
    }

    if (level === 0)
    {
        const { children } = raw
        if (Array.isArray(children))
        {
            const kidNodes = []

            for (let i = 0; i < children.length; i++)
            {
                const kid = children[i]
                const kidNode = collectNodesAndEdges(nodes, edges, config, kid, level + 1)
                kidNodes.push(kidNode)
            }

            for (let i = 0; i < kidNodes.length; i++)
            {
                const kidNode = kidNodes[i]
                const key = edgeKey(node, kidNode)
                if (!edges.has(key))
                {
                    edges.set(key, [node, kidNode])
                }
            }
        }
    }

    return node;
}


function renderAttrs(attrs)
{
    let out = ""
    let first = true
    for (let name in attrs)
    {
        if (attrs.hasOwnProperty(name))
        {
            const value = attrs[name]
            out += (first ? " " : ", ") + name + "=" + JSON.stringify(value)
        }
        first = false
    }
    return out
}


function generateNode(node)
{
    const attrs = {
        label: node.name,
        comments: node.artifacts.join(", "),
        shape: node.module ? "ellipse" : "box",
        style: "filled",
        fillcolor: node.module ? "#ddd" : "transparent"
    }

    return `    ${node.id} [${renderAttrs(attrs)}];`
}


function generateEdge([from, to])
{
    return `    ${ from } -> ${ to };`
}


function main()
{
    const { inputPaths, bucketsPath, shorten, outputPath } = handleCommandLineOptions()

    const bucketRules = bucketsPath ? parseBucketRules(bucketsPath) : []

    const config = {
        shorten,
        bucketRules
    }

    const nodes = new Map()
    const edges = new Map()

    inputPaths.forEach(
        p => {
            const raw = JSON.parse(fs.readFileSync(p, "utf-8"))

            collectNodesAndEdges(nodes, edges, config, raw)
        }
    )

    //console.log({nodes, edges})

    const output = trimIndent(`
        digraph {
        graph [pad="0.3"]
        ${ Array.from(nodes.values()).map( generateNode ).join("\n")}
        
        ${ Array.from(edges.values()).map( generateEdge ).join("\n")}         
        }`
    )

    if (outputPath)
    {
        fs.writeFileSync(outputPath, output, "utf-8")
    }
    else
    {
        console.log(
            output
        )
    }

}
main()
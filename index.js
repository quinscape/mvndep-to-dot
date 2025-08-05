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

const DEFAULT_CONFIG = {
    graphAttributes: (ctx, attrs) => { return attrs },
    nodeAttributes: (ctx, attrs) => { return attrs },
    edgeAttributes: null,
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
        .option("config", {
            alias: "c",
            describe: "location of a javascript config file to customize output",
        })
        .option("shorten", {
            alias: "s",
            describe: "Shorten unmatched artifacts by using only the artifact id instead of the full qualified group and artifact id",
        })
        .default("shorten", true)
        .help()

    const argv = Yargs.argv
    const {inputs, buckets, output, config } = argv
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
    return (
        config ? import(config).then(mod => {
            return mod.default
        }) : Promise.resolve(DEFAULT_CONFIG)
    ).then( cfg => {
        return {
            inputPaths,
            outputPath,
            bucketsPath,
            config : cfg,
            shorten: argv.shorten
        }
    })

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
 * @param ctx        config
 * @param raw           raw JSON
 * @param level         recursion level
 */
function collectNodesAndEdges(nodes, edges, ctx, raw, level = 0)
{
    const { bucketRules , shorten } = ctx

    const matched = matchRule(raw, bucketRules)

    if (matched && matched[0] === "!")
    {
        return null;
    }

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
                const kidNode = collectNodesAndEdges(nodes, edges, ctx, kid, level + 1)
                if (kidNode)
                {
                    kidNodes.push(kidNode)
                }
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


function renderAttrs(ctx, attrs)
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


function generateNode(ctx, node)
{
    ctx.node = node
    ctx.edge = null

    const attrs = ctx.config.nodeAttributes(ctx, {
        label: node.name,
        comments: node.artifacts.join(", "),
        shape: node.module ? "ellipse" : "box",
        style: "filled",
        fillcolor: node.module ? "#ddd" : "transparent"
    })

    return `    ${node.id} [${renderAttrs(ctx, attrs)}];`
}
const NO_ATTRS = {}

function generateEdge(ctx, edge)
{
    const [from, to] = edge
    let attrs;
    if (ctx.config.edgeAttributes)
    {
        ctx.node = null
        ctx.edge = edge
        attrs = ctx.config.edgeAttributes(ctx, from, to)
    }
    else
    {
        attrs = NO_ATTRS;
    }
    const s = renderAttrs(ctx, attrs);
    return `    ${ from } -> ${ to }${s ? "[ " + s + " ]" : ""};`
}


async function main()
{
    const { inputPaths, bucketsPath, shorten, outputPath, config} = await handleCommandLineOptions()

    const bucketRules = bucketsPath ? parseBucketRules(bucketsPath) : []


    const nodes = new Map()
    const edges = new Map()

    const ctx = {
        nodes,
        edges,
        bucketRules,
        config,
        shorten,
        node : null,
        edge: null
    }

    inputPaths.forEach(
        p => {
            const raw = JSON.parse(fs.readFileSync(p, "utf-8"))
            collectNodesAndEdges(nodes, edges, ctx, raw)
        }
    )

    //console.log({nodes, edges})

    const attrs = config.graphAttributes(ctx, {
        pad: "0.3"
    })

    const output = trimIndent(`
        digraph {
            graph [ ${renderAttrs(ctx, attrs)} ]
        ${ Array.from(nodes.values()).map( node => generateNode(ctx,node) ).join("\n")}
        
        ${ Array.from(edges.values()).map( edge => generateEdge(ctx,edge) ).join("\n")}         
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
main().catch(e => console.error(e));
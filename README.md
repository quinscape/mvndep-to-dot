# mvndeps-to-dot

Converts maven JSON dependency data into an abridged DOT output

## Getting JSON data from maven

You can direct the dependency plugin to output its dependency tree data as JSON. 
```shell
mvn org.apache.maven.plugins:maven-dependency-plugin:3.8.1:tree -DoutputType=json -DoutputFile=dependency.json
```
There seems to be a bug in older versions of that plugin which ignore the outputType option and write the text format 
instead. That's why it seems safer to use the fully qualified invocation.

After running above command you should have one or more dependency.json files. If you have sub modules the plugin will 
produce one dependency.json per module.

## Running @quinscape/mvndeps-to-dot 

Now we just need to feed all those dependency.json into our script

```shell
npx @quinscape/mvndeps-to-dot dependency.json
```

You either give the location of the JSON files via command line or you can use the --inputs option to read it from a file.

```shell
npx @quinscape/mvndeps-to-dot -i json-files.txt
```

## Buckets

Note that while the tool already simplifies the DOT output by only considering direct dependencies, it is still rather useless without 
bucket definitions. Buckets merge multiple artifacts into one logical node in the graph.

```json
{
  "Spring" : [ "org.springframework" ],
  "Spring Boot" : [ "org.springframework.boot" ],
  "Spring Data" : [ "org.springframework.data" ],
  "Security" : [ "org.springframework.security", "io.jsonwebtoken" ],
  "Testing" : [
    "org.mockito", "org.assertj", "org.seleniumhq.selenium", "org.junit.platform", "org.junit.vintage", "org.hamcrest",
    "io.github.bonigarcia", "com.intellij", "junit", "org.junit.jupiter" ]
}
```
The object keys define the name of the bucket. The values are always and array of matching expressions which are either 
just a maven group id or a fully qualified maven artefact with group id and artifactid separated by a colon. 
(Note: Without version!)

After you have written/updated your bucket definition, you can specify its location with the `--buckets` (or `-b`) option.

```shell
npx @quinscape/mvndeps-to-dot -b buckets.json dependency.json
```

## Customization

DOT output can be customized with the ´--config´ / ´-c´ 

```javascript
const config = {
    graphAttributes: (ctx, attrs) => {
        attrs.bgcolor = "#f0f0f0"
        return attrs
    },
    nodeAttributes:  (ctx, attrs) => {
        attrs.fillcolor = "#f0f"
        return attrs
    },
    edegeAttributes: (ctx, from, to) => {
        return { 
            color: "#f00"
        }        
    }
}
export default config;
```

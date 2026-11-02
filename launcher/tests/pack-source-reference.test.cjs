'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),report=require('../../docs/iris-pack-includes-reference.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('include graph reference matches exact pinned Iris class bytes and pre-conditional cycle behavior',async()=>{
 const jar=fs.readFileSync(path.join(root,'outputs/iris-reference/iris-reference.jar'));assert.equal(crypto.createHash('sha512').update(jar).digest('hex'),report.artifactSha512);const zip=await require('unzipper').Open.buffer(jar),read=require('../../tools/read-java-class.cjs');
 for(const c of report.classes){const bytes=await zip.files.find(f=>f.path===c.file).buffer();assert.equal(sha(bytes),c.sha256);assert.deepEqual(read(bytes).methods,c.methods);}
 assert.ok(report.classes.find(c=>c.type.endsWith('/IncludeGraph')).methods.flatMap(m=>m.operations).some(o=>o.target.includes('#include directives are resolved before any other preprocessor directives')));
 assert.equal(report.javaExecuted,false);assert.equal(report.productionActivated,false);assert.equal(report.irisContractComplete,false);
});
test('pack source limits and native freshness cover both acquisition and virtual resolution without altering source/production contracts',()=>{
 assert.deepEqual(require('../shader-pack-files.cjs').LIMITS,report.nodeLimits);assert.equal(report.includeLimits.snapshotBytes,report.nodeLimits.snapshot);assert.equal(report.includeLimits.totalTextBytes,report.nodeLimits.textTotal);
 const baseline=require('../../outputs/properties-loader-0.6.56/native-verification.json');for(const file of ['src/bridge_render_graph.hpp','src/bridge_protocol.hpp','src/bridge_geometry_shaders.hpp','src/bridge_pipeline.hpp','src/bridge_graph_shaders.hpp','src/bridge_renderer.hpp','src/shader_loader/block_ids.hpp','src/shader_loader/properties_preprocessor.hpp','bridge/capture-factory.cjs','bridge/source-emission.cjs'])assert.equal(sha(fs.readFileSync(path.join(root,file))),baseline.sources.find(s=>s.file===file).sha256);
 const verifier=fs.readFileSync(path.join(root,'tools/verify-native-renderer.cjs'),'utf8');for(const file of ['src/shader_loader/pack_sources.hpp','src/shader_loader/include_resolver.hpp','src/bridge_pack_sources_tests.hpp'])assert.ok(verifier.includes("'"+file+"'"));
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/main.cpp'),'utf8'),/preparePackMaterials|IncludeResolver|PackSources::decode/);
});
test('source reader is shipped as a callable pack-service component and never added to a page preload or run protocol',()=>{
 assert.equal(require('../minecraft-packs.cjs').readSources,require('../shader-pack-files.cjs').readShaderPack);
 assert.match(fs.readFileSync(path.join(root,'electron-builder.yml'),'utf8'),/- launcher\/shader-pack-files\.cjs/);
 for(const file of ['launcher/main.cjs','launcher/preload.cjs','launcher/game-preload.cjs','launcher/game-runner.cjs'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/readSources|shader-pack-files|SPK1/);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/shader_loader/include_resolver.hpp'),'utf8'),/ifstream|fstream|CreateProcess|glGen|std::filesystem/);
});

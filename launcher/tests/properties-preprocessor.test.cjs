'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),report=require('../../docs/iris-properties-preprocessor-reference.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('property preprocessing evidence matches pinned Iris and nested JCPP macro class bytes',async()=>{
 const pinned=require('../../docs/iris-material-id-reference.json'),jar=fs.readFileSync(path.join(root,'outputs/iris-reference/iris-reference.jar'));
 assert.equal(crypto.createHash('sha512').update(jar).digest('hex'),pinned.artifactSha512);assert.equal(report.artifactSha512,pinned.artifactSha512);
 const zip=await require('unzipper').Open.buffer(jar),read=require('../../tools/read-java-class.cjs');
 for(const c of report.classes){const b=await zip.files.find(f=>f.path===c.file).buffer();assert.equal(sha(b),c.sha256);assert.deepEqual(read(b).methods,c.methods);}
 const ops=report.classes[0].methods.filter(m=>m.key==='preprocessSource'||m.key==='process').flatMap(m=>m.operations);
 assert.ok(ops.some(o=>o.target==='#warning IRIS_PASSTHROUGH '));assert.ok(ops.some(o=>o.target==='IRIS_PASSTHROUGHBACKSLASH'));
 assert.ok(ops.some(o=>o.target==='org/anarres/cpp/Preprocessor.addMacro(Ljava/lang/String;Ljava/lang/String;)V'));
 const dependency=await zip.files.find(f=>f.path===report.jcpp.file).buffer();assert.equal(sha(dependency),report.jcpp.sha256);const nested=await require('unzipper').Open.buffer(dependency),cpp=await nested.files.find(f=>f.path===report.jcpp.classFile).buffer();assert.equal(sha(cpp),report.jcpp.classSha256);assert.deepEqual(read(cpp).methods.find(m=>m.key==='addMacro'&&m.descriptor==='(Ljava/lang/String;)V'),report.jcpp.addBoolean);assert.ok(report.jcpp.addBoolean.operations.some(o=>o.target==='1'));
 assert.equal(sha(fs.readFileSync(path.join(root,report.supportingPublicSource.local))),report.supportingPublicSource.sha256);assert.equal(report.supportingPublicSource.exactReleaseSourceTagEstablished,false);
 assert.equal(report.javaExecuted,false);assert.equal(report.productionActivated,false);assert.equal(report.irisContractComplete,false);
});
test('material preprocessing keeps source observation and production shader bytes outside the loader change',()=>{
 const baseline=require('../../outputs/fluids-0.6.55/native-verification.json');
 for(const file of ['bridge/capture-factory.cjs','bridge/source-emission.cjs','bridge/source-light.cjs','bridge/source-frame.cjs','src/bridge_protocol.hpp','src/bridge_geometry_shaders.hpp','src/bridge_graph_shaders.hpp','src/bridge_renderer.hpp','src/bridge_pipeline.hpp','src/bridge_gpu_particle_shaders.hpp'])assert.equal(sha(fs.readFileSync(path.join(root,file))),baseline.sources.find(s=>s.file===file).sha256);
 for(const file of ['src/shader_loader/properties_preprocessor.hpp','src/shader_loader/material_loader.hpp'])assert.doesNotMatch(fs.readFileSync(path.join(root,file),'utf8'),/\b(?:system|CreateProcess|ShellExecute|glGenBuffers|glGenTextures|ifstream|fstream|fetch|eval)\s*\(/);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/main.cpp'),'utf8'),/prepareBlockMaterials|PropertiesPreprocessor|parsePreprocessed/);
});
test('native freshness gate covers both new loader headers and their CPU failure/reload tests',()=>{
 const code=fs.readFileSync(path.join(root,'tools/verify-native-renderer.cjs'),'utf8');
 for(const file of ['src/shader_loader/properties_preprocessor.hpp','src/shader_loader/material_loader.hpp','src/bridge_properties_tests.hpp'])assert.ok(code.includes("'"+file+"'"));
 assert.deepEqual(report.limits,{inputBytes:262144,outputBytes:262144,macroNames:256,macroTextBytes:65536,trimmedLineBytes:16384,expressionTextBytes:4096,expandedTokens:4096,conditionalDepth:32,expressionDepth:32,macroDepth:16,workUnits:1048576});
 assert.match(report.unknownPolicy,/stricter guard/);assert.equal(report.clientsStarted,0);assert.equal(report.graphicsContextsCreated,0);
});

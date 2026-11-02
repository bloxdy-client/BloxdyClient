'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),report=require('../../docs/iris-glsl-preprocessor-reference.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('GLSL preprocessing evidence matches pinned Iris, nested JCPP and supporting Maven bytes',async()=>{
 const pinned=require('../../docs/iris-material-id-reference.json'),jar=fs.readFileSync(path.join(root,'outputs/iris-reference/iris-reference.jar'));
 assert.equal(crypto.createHash('sha512').update(jar).digest('hex'),pinned.artifactSha512);assert.equal(report.artifactSha512,pinned.artifactSha512);const zip=await require('unzipper').Open.buffer(jar),read=require('../../tools/read-java-class.cjs');
 for(const c of report.classes){const b=await zip.files.find(f=>f.path===c.file).buffer();assert.equal(sha(b),c.sha256);assert.deepEqual(read(b).methods,c.methods);}
 const dependency=await zip.files.find(f=>f.path===report.jcpp.file).buffer();assert.equal(sha(dependency),report.jcpp.sha256);const nested=await require('unzipper').Open.buffer(dependency),b=await nested.files.find(f=>f.path===report.jcpp.classFile).buffer();assert.equal(sha(b),report.jcpp.classSha256);assert.deepEqual(read(b).methods.find(m=>m.key==='expr'),report.jcpp.expression);
 const source=report.supportingSource;for(const [local,digest]of [[source.local,source.sha256],[source.archiveLocal,source.archiveSha256],[source.binaryLocal,source.binarySha256]])assert.equal(sha(fs.readFileSync(path.join(root,local))),digest);
 const maven=await require('unzipper').Open.file(path.join(root,source.binaryLocal));assert.equal(sha(await maven.files.find(f=>f.path===report.jcpp.classFile).buffer()),report.jcpp.classSha256);assert.equal(source.exactIrisReleaseSourceTagEstablished,false);
 assert.equal(report.javaExecuted,false);assert.equal(report.productionActivated,false);assert.equal(report.irisContractComplete,false);
});
test('GLSL preparation preserves production shaders, source observation and existing material stages',()=>{
 const baseline=require('../../outputs/pack-sources-0.6.57/native-verification.json');
 for(const file of ['src/main.cpp','bridge/capture-factory.cjs','bridge/source-frame.cjs','bridge/source-emission.cjs','bridge/source-light.cjs','src/bridge_protocol.hpp','src/bridge_render_graph.hpp','src/bridge_renderer.hpp','src/bridge_pipeline.hpp','src/bridge_geometry_shaders.hpp','src/bridge_graph_shaders.hpp','src/bridge_gpu_particle_shaders.hpp','src/shader_loader/block_ids.hpp','src/shader_loader/properties_preprocessor.hpp','src/shader_loader/pack_sources.hpp','src/shader_loader/include_resolver.hpp','launcher/shader-pack-files.cjs'])assert.equal(sha(fs.readFileSync(path.join(root,file))),baseline.sources.find(s=>s.file===file).sha256,file);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/shader_loader/glsl_preprocessor.hpp'),'utf8'),/\b(?:system|CreateProcess|ShellExecute|ifstream|fstream|glCreateShader|glGenTextures|glGenBuffers)\s*\(/);
 assert.doesNotMatch(fs.readFileSync(path.join(root,'src/main.cpp'),'utf8'),/preparePackShader|GlslPreprocessor/);
});
test('native verification requires fresh GLSL preparation and separate compiler/oracle diagnostics',()=>{
 const code=fs.readFileSync(path.join(root,'tools/verify-native-renderer.cjs'),'utf8');for(const f of ['src/shader_loader/glsl_preprocessor.hpp','src/bridge_glsl_preprocessor_tests.hpp'])assert.ok(code.includes("'"+f+"'"));
 for(const name of ['pack-glsl-positive','pack-glsl-compute','pack-glsl-negative','macro/bad.glsl:2','glslPreprocessingOracle'])assert.ok(code.includes(name));
 assert.equal(report.limits.outputBytes,8388608);assert.equal(report.limits.macroNames,512);assert.equal(report.limits.workUnits,33554432);assert.equal(report.clientsStarted,0);assert.equal(report.graphicsContextsCreated,0);assert.match(report.unknownPolicy,/Extension requests never prove support/);
});

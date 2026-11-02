#pragma once
#include "block_ids.hpp"
#include "properties_preprocessor.hpp"
#include "include_resolver.hpp"
#include "glsl_preprocessor.hpp"
#include "glsl_translation.hpp"
#include "linked_program.hpp"
#include "program_bindings.hpp"
#include "program_uniforms.hpp"
#include "program_textures.hpp"
#include "program_vertices.hpp"
#include "program_outputs.hpp"
#include "test_pass.hpp"
#include "two_pass.hpp"

namespace bridge::shaderloader {
// Prepare a new immutable material table before assigning it to IrisPlan.
// Failure returns no partial table and never mutates an installed plan/context.
// Explicit pack snapshots/includes are available; translation and production
// activation remain separate. No filesystem or runtime context is discovered.
struct PreparedBlockMaterials {
    std::shared_ptr<const BlockIdMap> blockIds;
    PreparedProperties properties;
};
inline PreparedBlockMaterials prepareBlockMaterials(std::string_view source,const std::vector<PropertyMacro>& context){
    auto properties=PropertiesPreprocessor::prepare(source,context);
    auto ids=BlockIdMap::parsePreprocessed(properties.text);
    return {std::move(ids),std::move(properties)};
}
inline PreparedBlockMaterials preparePackMaterials(const PackSources& sources,const std::vector<PropertyMacro>& context){return prepareBlockMaterials(sources.read("block.properties"),context);}
}

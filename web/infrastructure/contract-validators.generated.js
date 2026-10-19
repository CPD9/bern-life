// Generated from contracts/*.schema.json by `bun run contract:validators`. Do not edit.
import { fullFormats } from "ajv-formats/dist/formats";
import runtime_equal from "ajv/dist/runtime/equal";
import runtime_ucs2length from "ajv/dist/runtime/ucs2length";
export const isSearchResponse = validate20;
const schema31 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"result.schema.json","title":"SearchResponse","description":"What the engine returns for a query or a project brief (POST /api/search, POST /api/brief). The UI renders only this.","type":"object","required":["query","mode","abstained","results","expanded_terms","versions"],"additionalProperties":false,"properties":{"query":{"type":"string"},"brief_terms":{"description":"For a brief: the needs Apertus read from it, each with the brief sentence it came from. Absent for a plain query.","type":"array","items":{"type":"object","required":["term","span"],"additionalProperties":false,"properties":{"term":{"type":"string"},"span":{"type":"string"}}}},"mode":{"description":"live: a model answered now; replay: from the cache; mock: no model, canned text, the UI shows a MOCK banner.","enum":["live","replay","mock"]},"abstained":{"type":"boolean"},"abstain_reason":{"enum":["no_verifiable_source","query_out_of_scope","engine_error",null]},"expanded_terms":{"description":"Retrieval terms added by enrichment and query expansion. Used for search only, never shown as a fact about a person.","type":"array","items":{"type":"object","required":["term","kind"],"additionalProperties":false,"properties":{"term":{"type":"string"},"kind":{"enum":["synonym","lay","translation","acronym"]},"lang":{"enum":["de","en","fr","it"]}}}},"results":{"type":"array","maxItems":50,"items":{"type":"object","required":["rank","profile","reason","score"],"additionalProperties":false,"properties":{"rank":{"type":"integer","minimum":1},"profile":{"$ref":"profile.schema.json"},"reason":{"description":"Why it matches, written only from the cited claims. `cites` are JSON pointers into the result: /name or /fields/expertise/0 for a claim of the profile's own, /via/related_claims/0 for a claim of the project the result is shown through.","type":"object","required":["text","cites"],"additionalProperties":false,"properties":{"text":{"type":"string","minLength":1,"maxLength":400},"cites":{"type":"array","minItems":1,"items":{"type":"string","pattern":"^/(name|fields/[a-z]+/[0-9]+|via/related_claims/[0-9]+)$"}}}},"score":{"type":"object","required":["fused"],"additionalProperties":false,"properties":{"fused":{"type":"number"},"lexical_rank":{"type":["integer","null"]},"vector_rank":{"type":["integer","null"]}}},"metrics":{"description":"Display only: describes a result, never reorders it. null means it could not be computed (shown as a dash, never 0). Computed from verified claims and pages, never from a model's opinion.","type":"object","additionalProperties":false,"required":["relevance","covers","missing","evidence","completeness","novelty","confidence"],"properties":{"relevance":{"type":["number","null"],"minimum":0,"maximum":1},"evidence":{"type":["number","null"],"minimum":0,"maximum":1},"confidence":{"type":["number","null"],"minimum":0,"maximum":1},"covers":{"type":"array","items":{"type":"string"}},"missing":{"type":"array","items":{"type":"string"}},"completeness":{"type":"object","required":["filled","of"],"additionalProperties":false,"properties":{"filled":{"type":"integer","minimum":0},"of":{"const":5}}},"novelty":{"type":"object","required":["new_unit","adds"],"additionalProperties":false,"properties":{"new_unit":{"type":"boolean"},"adds":{"type":"array","items":{"type":"string"}}}}}},"via":{"description":"When the result's own claims do not match the question but a related project or unit does: the relation (its verbatim span on its page) and the related profile's matching claims, inline, so both sentences are shown and checked. The result's reason is the relation sentence written from them, citing these claims.","type":"object","additionalProperties":false,"required":["kind","span","page_url","page_sha256","related_profile_id","related_name","related_claims"],"properties":{"kind":{"enum":["leads","works_on","member_of"]},"span":{"type":"string","minLength":1,"maxLength":300},"page_url":{"type":"string","format":"uri"},"page_sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"},"start":{"type":"integer","minimum":0},"fetched_at":{"type":"string","format":"date-time"},"related_profile_id":{"type":"string","pattern":"^(person|unit|project|infrastructure)-[a-z0-9-]+$"},"related_name":{"type":"string","minLength":1},"related_claims":{"type":"array","minItems":1,"items":{"$ref":"profile.schema.json#/$defs/claim"}}}},"passage":{"description":"When neither the result's own claims nor a related project's match the question, but its own page (the page its name claim cites) does next to its name: the verbatim span from the name to the nearest words matching two distinct word forms of the question, within 300 characters and never across the name of another profile cited on that page. A passage on their page, not a claim of their profile; the reason stays the plain one from the profile's own claims.","type":"object","additionalProperties":false,"required":["kind","span","page_url","page_sha256","start","fetched_at"],"properties":{"kind":{"const":"own_page"},"span":{"type":"string","minLength":1,"maxLength":600},"page_url":{"type":"string","format":"uri"},"page_sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"},"start":{"type":"integer","minimum":0},"fetched_at":{"type":"string","format":"date-time"}}}}}},"timings_ms":{"type":"object","additionalProperties":{"type":"number"}},"versions":{"type":"object","required":["engine","snapshot","prompts"],"additionalProperties":false,"properties":{"engine":{"type":"string"},"snapshot":{"type":"string"},"prompts":{"type":"string"},"models":{"type":"object","additionalProperties":{"type":"string"}}}}}};
const func1 = Object.prototype.hasOwnProperty;
const func2 = runtime_ucs2length;
const schema32 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"profile.schema.json","title":"Profile","description":"A person, unit, project or infrastructure built from stored pages. Every value is a claim with a verbatim span from a stored page; a field the pages do not support is an empty list, never a guess. No email or phone is stored: contact goes through the source page link. Calls, services and spaces (opportunities) use the optional fields funder, deadline, amount, eligibility, location and size; dates and amounts are verbatim text from the page, never parsed or computed.","type":"object","required":["id","kind","source_id","name","fields","source_url"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^(person|unit|project|infrastructure|call|service|space)-[a-z0-9-]+$"},"kind":{"enum":["person","unit","project","infrastructure","call","service","space"]},"source_id":{"type":"string","pattern":"^[a-z0-9-]+$"},"name":{"$ref":"#/$defs/claim"},"source_url":{"description":"The main page for this profile, shown as the result link.","type":"string","format":"uri"},"fields":{"type":"object","required":["role","unit","expertise","projects","infrastructure","services"],"additionalProperties":false,"properties":{"role":{"$ref":"#/$defs/claims"},"unit":{"$ref":"#/$defs/claims"},"expertise":{"$ref":"#/$defs/claims"},"projects":{"$ref":"#/$defs/claims"},"infrastructure":{"$ref":"#/$defs/claims"},"services":{"$ref":"#/$defs/claims"},"funder":{"$ref":"#/$defs/claims"},"deadline":{"$ref":"#/$defs/claims"},"amount":{"$ref":"#/$defs/claims"},"eligibility":{"$ref":"#/$defs/claims"},"location":{"$ref":"#/$defs/claims"},"size":{"$ref":"#/$defs/claims"}}}},"$defs":{"claims":{"type":"array","items":{"$ref":"#/$defs/claim"}},"claim":{"type":"object","required":["value","evidence","method"],"additionalProperties":false,"properties":{"value":{"type":"string","minLength":1,"maxLength":200},"method":{"description":"selector: read by a per-source rule; model: proposed by Apertus and kept only because the verifier found the span.","enum":["selector","model"]},"evidence":{"$ref":"#/$defs/evidence"}}},"evidence":{"type":"object","required":["page_url","page_sha256","span"],"additionalProperties":false,"properties":{"page_url":{"type":"string","format":"uri"},"page_sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"},"span":{"description":"Verbatim substring of the page's stored text.","type":"string","minLength":1,"maxLength":300},"start":{"description":"Character offset of span in the page text.","type":"integer","minimum":0},"fetched_at":{"description":"When the page holding the span was fetched (copied from the page record).","type":"string","format":"date-time"}}}}};
const pattern4 = new RegExp("^(person|unit|project|infrastructure|call|service|space)-[a-z0-9-]+$", "u");
const pattern5 = new RegExp("^[a-z0-9-]+$", "u");
const schema33 = {"type":"object","required":["value","evidence","method"],"additionalProperties":false,"properties":{"value":{"type":"string","minLength":1,"maxLength":200},"method":{"description":"selector: read by a per-source rule; model: proposed by Apertus and kept only because the verifier found the span.","enum":["selector","model"]},"evidence":{"$ref":"#/$defs/evidence"}}};
const schema34 = {"type":"object","required":["page_url","page_sha256","span"],"additionalProperties":false,"properties":{"page_url":{"type":"string","format":"uri"},"page_sha256":{"type":"string","pattern":"^[0-9a-f]{64}$"},"span":{"description":"Verbatim substring of the page's stored text.","type":"string","minLength":1,"maxLength":300},"start":{"description":"Character offset of span in the page text.","type":"integer","minimum":0},"fetched_at":{"description":"When the page holding the span was fetched (copied from the page record).","type":"string","format":"date-time"}}};
const formats0 = fullFormats.uri;
const formats2 = fullFormats["date-time"];
const pattern6 = new RegExp("^[0-9a-f]{64}$", "u");

function validate22(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate22.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((data.value === undefined) && (missing0 = "value")) || ((data.evidence === undefined) && (missing0 = "evidence"))) || ((data.method === undefined) && (missing0 = "method"))){
validate22.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!(((key0 === "value") || (key0 === "method")) || (key0 === "evidence"))){
validate22.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.value !== undefined){
let data0 = data.value;
const _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(func2(data0) > 200){
validate22.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/maxLength",keyword:"maxLength",params:{limit: 200},message:"must NOT have more than 200 characters"}];
return false;
}
else {
if(func2(data0) < 1){
validate22.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate22.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.method !== undefined){
let data1 = data.method;
const _errs4 = errors;
if(!((data1 === "selector") || (data1 === "model"))){
validate22.errors = [{instancePath:instancePath+"/method",schemaPath:"#/properties/method/enum",keyword:"enum",params:{allowedValues: schema33.properties.method.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.evidence !== undefined){
let data2 = data.evidence;
const _errs5 = errors;
const _errs6 = errors;
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
let missing1;
if((((data2.page_url === undefined) && (missing1 = "page_url")) || ((data2.page_sha256 === undefined) && (missing1 = "page_sha256"))) || ((data2.span === undefined) && (missing1 = "span"))){
validate22.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs8 = errors;
for(const key1 in data2){
if(!(((((key1 === "page_url") || (key1 === "page_sha256")) || (key1 === "span")) || (key1 === "start")) || (key1 === "fetched_at"))){
validate22.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs8 === errors){
if(data2.page_url !== undefined){
let data3 = data2.page_url;
const _errs9 = errors;
if(errors === _errs9){
if(errors === _errs9){
if(typeof data3 === "string"){
if(!(formats0(data3))){
validate22.errors = [{instancePath:instancePath+"/evidence/page_url",schemaPath:"#/$defs/evidence/properties/page_url/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""}];
return false;
}
}
else {
validate22.errors = [{instancePath:instancePath+"/evidence/page_url",schemaPath:"#/$defs/evidence/properties/page_url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid2 = _errs9 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.page_sha256 !== undefined){
let data4 = data2.page_sha256;
const _errs11 = errors;
if(errors === _errs11){
if(typeof data4 === "string"){
if(!pattern6.test(data4)){
validate22.errors = [{instancePath:instancePath+"/evidence/page_sha256",schemaPath:"#/$defs/evidence/properties/page_sha256/pattern",keyword:"pattern",params:{pattern: "^[0-9a-f]{64}$"},message:"must match pattern \""+"^[0-9a-f]{64}$"+"\""}];
return false;
}
}
else {
validate22.errors = [{instancePath:instancePath+"/evidence/page_sha256",schemaPath:"#/$defs/evidence/properties/page_sha256/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs11 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.span !== undefined){
let data5 = data2.span;
const _errs13 = errors;
if(errors === _errs13){
if(typeof data5 === "string"){
if(func2(data5) > 300){
validate22.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/maxLength",keyword:"maxLength",params:{limit: 300},message:"must NOT have more than 300 characters"}];
return false;
}
else {
if(func2(data5) < 1){
validate22.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate22.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs13 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.start !== undefined){
let data6 = data2.start;
const _errs15 = errors;
if(!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))){
validate22.errors = [{instancePath:instancePath+"/evidence/start",schemaPath:"#/$defs/evidence/properties/start/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs15){
if((typeof data6 == "number") && (isFinite(data6))){
if(data6 < 0 || isNaN(data6)){
validate22.errors = [{instancePath:instancePath+"/evidence/start",schemaPath:"#/$defs/evidence/properties/start/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid2 = _errs15 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.fetched_at !== undefined){
let data7 = data2.fetched_at;
const _errs17 = errors;
if(errors === _errs17){
if(errors === _errs17){
if(typeof data7 === "string"){
if(!(formats2.validate(data7))){
validate22.errors = [{instancePath:instancePath+"/evidence/fetched_at",schemaPath:"#/$defs/evidence/properties/fetched_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
else {
validate22.errors = [{instancePath:instancePath+"/evidence/fetched_at",schemaPath:"#/$defs/evidence/properties/fetched_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid2 = _errs17 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
}
}
}
else {
validate22.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs5 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
else {
validate22.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate22.errors = vErrors;
return errors === 0;
}
validate22.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

const schema35 = {"type":"array","items":{"$ref":"#/$defs/claim"}};

function validate24(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate24.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(Array.isArray(data)){
var valid0 = true;
const len0 = data.length;
for(let i0=0; i0<len0; i0++){
const _errs1 = errors;
if(!(validate22(data[i0], {instancePath:instancePath+"/" + i0,parentData:data,parentDataProperty:i0,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
errors = vErrors.length;
}
var valid0 = _errs1 === errors;
if(!valid0){
break;
}
}
}
else {
validate24.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
validate24.errors = vErrors;
return errors === 0;
}
validate24.evaluated = {"items":true,"dynamicProps":false,"dynamicItems":false};


function validate21(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="profile.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate21.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((((((data.id === undefined) && (missing0 = "id")) || ((data.kind === undefined) && (missing0 = "kind"))) || ((data.source_id === undefined) && (missing0 = "source_id"))) || ((data.name === undefined) && (missing0 = "name"))) || ((data.fields === undefined) && (missing0 = "fields"))) || ((data.source_url === undefined) && (missing0 = "source_url"))){
validate21.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((((((key0 === "id") || (key0 === "kind")) || (key0 === "source_id")) || (key0 === "name")) || (key0 === "source_url")) || (key0 === "fields"))){
validate21.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.id !== undefined){
let data0 = data.id;
const _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(!pattern4.test(data0)){
validate21.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/pattern",keyword:"pattern",params:{pattern: "^(person|unit|project|infrastructure|call|service|space)-[a-z0-9-]+$"},message:"must match pattern \""+"^(person|unit|project|infrastructure|call|service|space)-[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate21.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.kind !== undefined){
let data1 = data.kind;
const _errs4 = errors;
if(!(((((((data1 === "person") || (data1 === "unit")) || (data1 === "project")) || (data1 === "infrastructure")) || (data1 === "call")) || (data1 === "service")) || (data1 === "space"))){
validate21.errors = [{instancePath:instancePath+"/kind",schemaPath:"#/properties/kind/enum",keyword:"enum",params:{allowedValues: schema32.properties.kind.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.source_id !== undefined){
let data2 = data.source_id;
const _errs5 = errors;
if(errors === _errs5){
if(typeof data2 === "string"){
if(!pattern5.test(data2)){
validate21.errors = [{instancePath:instancePath+"/source_id",schemaPath:"#/properties/source_id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9-]+$"},message:"must match pattern \""+"^[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate21.errors = [{instancePath:instancePath+"/source_id",schemaPath:"#/properties/source_id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs5 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.name !== undefined){
const _errs7 = errors;
if(!(validate22(data.name, {instancePath:instancePath+"/name",parentData:data,parentDataProperty:"name",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
errors = vErrors.length;
}
var valid0 = _errs7 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.source_url !== undefined){
let data4 = data.source_url;
const _errs8 = errors;
if(errors === _errs8){
if(errors === _errs8){
if(typeof data4 === "string"){
if(!(formats0(data4))){
validate21.errors = [{instancePath:instancePath+"/source_url",schemaPath:"#/properties/source_url/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""}];
return false;
}
}
else {
validate21.errors = [{instancePath:instancePath+"/source_url",schemaPath:"#/properties/source_url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid0 = _errs8 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.fields !== undefined){
let data5 = data.fields;
const _errs10 = errors;
if(errors === _errs10){
if(data5 && typeof data5 == "object" && !Array.isArray(data5)){
let missing1;
if(((((((data5.role === undefined) && (missing1 = "role")) || ((data5.unit === undefined) && (missing1 = "unit"))) || ((data5.expertise === undefined) && (missing1 = "expertise"))) || ((data5.projects === undefined) && (missing1 = "projects"))) || ((data5.infrastructure === undefined) && (missing1 = "infrastructure"))) || ((data5.services === undefined) && (missing1 = "services"))){
validate21.errors = [{instancePath:instancePath+"/fields",schemaPath:"#/properties/fields/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs12 = errors;
for(const key1 in data5){
if(!(func1.call(schema32.properties.fields.properties, key1))){
validate21.errors = [{instancePath:instancePath+"/fields",schemaPath:"#/properties/fields/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs12 === errors){
if(data5.role !== undefined){
const _errs13 = errors;
if(!(validate24(data5.role, {instancePath:instancePath+"/fields/role",parentData:data5,parentDataProperty:"role",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs13 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.unit !== undefined){
const _errs14 = errors;
if(!(validate24(data5.unit, {instancePath:instancePath+"/fields/unit",parentData:data5,parentDataProperty:"unit",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs14 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.expertise !== undefined){
const _errs15 = errors;
if(!(validate24(data5.expertise, {instancePath:instancePath+"/fields/expertise",parentData:data5,parentDataProperty:"expertise",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs15 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.projects !== undefined){
const _errs16 = errors;
if(!(validate24(data5.projects, {instancePath:instancePath+"/fields/projects",parentData:data5,parentDataProperty:"projects",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs16 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.infrastructure !== undefined){
const _errs17 = errors;
if(!(validate24(data5.infrastructure, {instancePath:instancePath+"/fields/infrastructure",parentData:data5,parentDataProperty:"infrastructure",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs17 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.services !== undefined){
const _errs18 = errors;
if(!(validate24(data5.services, {instancePath:instancePath+"/fields/services",parentData:data5,parentDataProperty:"services",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs18 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.funder !== undefined){
const _errs19 = errors;
if(!(validate24(data5.funder, {instancePath:instancePath+"/fields/funder",parentData:data5,parentDataProperty:"funder",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs19 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.deadline !== undefined){
const _errs20 = errors;
if(!(validate24(data5.deadline, {instancePath:instancePath+"/fields/deadline",parentData:data5,parentDataProperty:"deadline",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs20 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.amount !== undefined){
const _errs21 = errors;
if(!(validate24(data5.amount, {instancePath:instancePath+"/fields/amount",parentData:data5,parentDataProperty:"amount",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs21 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.eligibility !== undefined){
const _errs22 = errors;
if(!(validate24(data5.eligibility, {instancePath:instancePath+"/fields/eligibility",parentData:data5,parentDataProperty:"eligibility",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs22 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.location !== undefined){
const _errs23 = errors;
if(!(validate24(data5.location, {instancePath:instancePath+"/fields/location",parentData:data5,parentDataProperty:"location",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs23 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data5.size !== undefined){
const _errs24 = errors;
if(!(validate24(data5.size, {instancePath:instancePath+"/fields/size",parentData:data5,parentDataProperty:"size",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
errors = vErrors.length;
}
var valid1 = _errs24 === errors;
}
else {
var valid1 = true;
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
else {
validate21.errors = [{instancePath:instancePath+"/fields",schemaPath:"#/properties/fields/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs10 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
else {
validate21.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate21.errors = vErrors;
return errors === 0;
}
validate21.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate39(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate39.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((data.value === undefined) && (missing0 = "value")) || ((data.evidence === undefined) && (missing0 = "evidence"))) || ((data.method === undefined) && (missing0 = "method"))){
validate39.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!(((key0 === "value") || (key0 === "method")) || (key0 === "evidence"))){
validate39.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.value !== undefined){
let data0 = data.value;
const _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(func2(data0) > 200){
validate39.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/maxLength",keyword:"maxLength",params:{limit: 200},message:"must NOT have more than 200 characters"}];
return false;
}
else {
if(func2(data0) < 1){
validate39.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate39.errors = [{instancePath:instancePath+"/value",schemaPath:"#/properties/value/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.method !== undefined){
let data1 = data.method;
const _errs4 = errors;
if(!((data1 === "selector") || (data1 === "model"))){
validate39.errors = [{instancePath:instancePath+"/method",schemaPath:"#/properties/method/enum",keyword:"enum",params:{allowedValues: schema33.properties.method.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.evidence !== undefined){
let data2 = data.evidence;
const _errs5 = errors;
const _errs6 = errors;
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
let missing1;
if((((data2.page_url === undefined) && (missing1 = "page_url")) || ((data2.page_sha256 === undefined) && (missing1 = "page_sha256"))) || ((data2.span === undefined) && (missing1 = "span"))){
validate39.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs8 = errors;
for(const key1 in data2){
if(!(((((key1 === "page_url") || (key1 === "page_sha256")) || (key1 === "span")) || (key1 === "start")) || (key1 === "fetched_at"))){
validate39.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs8 === errors){
if(data2.page_url !== undefined){
let data3 = data2.page_url;
const _errs9 = errors;
if(errors === _errs9){
if(errors === _errs9){
if(typeof data3 === "string"){
if(!(formats0(data3))){
validate39.errors = [{instancePath:instancePath+"/evidence/page_url",schemaPath:"#/$defs/evidence/properties/page_url/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""}];
return false;
}
}
else {
validate39.errors = [{instancePath:instancePath+"/evidence/page_url",schemaPath:"#/$defs/evidence/properties/page_url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid2 = _errs9 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.page_sha256 !== undefined){
let data4 = data2.page_sha256;
const _errs11 = errors;
if(errors === _errs11){
if(typeof data4 === "string"){
if(!pattern6.test(data4)){
validate39.errors = [{instancePath:instancePath+"/evidence/page_sha256",schemaPath:"#/$defs/evidence/properties/page_sha256/pattern",keyword:"pattern",params:{pattern: "^[0-9a-f]{64}$"},message:"must match pattern \""+"^[0-9a-f]{64}$"+"\""}];
return false;
}
}
else {
validate39.errors = [{instancePath:instancePath+"/evidence/page_sha256",schemaPath:"#/$defs/evidence/properties/page_sha256/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs11 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.span !== undefined){
let data5 = data2.span;
const _errs13 = errors;
if(errors === _errs13){
if(typeof data5 === "string"){
if(func2(data5) > 300){
validate39.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/maxLength",keyword:"maxLength",params:{limit: 300},message:"must NOT have more than 300 characters"}];
return false;
}
else {
if(func2(data5) < 1){
validate39.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate39.errors = [{instancePath:instancePath+"/evidence/span",schemaPath:"#/$defs/evidence/properties/span/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs13 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.start !== undefined){
let data6 = data2.start;
const _errs15 = errors;
if(!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))){
validate39.errors = [{instancePath:instancePath+"/evidence/start",schemaPath:"#/$defs/evidence/properties/start/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs15){
if((typeof data6 == "number") && (isFinite(data6))){
if(data6 < 0 || isNaN(data6)){
validate39.errors = [{instancePath:instancePath+"/evidence/start",schemaPath:"#/$defs/evidence/properties/start/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid2 = _errs15 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.fetched_at !== undefined){
let data7 = data2.fetched_at;
const _errs17 = errors;
if(errors === _errs17){
if(errors === _errs17){
if(typeof data7 === "string"){
if(!(formats2.validate(data7))){
validate39.errors = [{instancePath:instancePath+"/evidence/fetched_at",schemaPath:"#/$defs/evidence/properties/fetched_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
else {
validate39.errors = [{instancePath:instancePath+"/evidence/fetched_at",schemaPath:"#/$defs/evidence/properties/fetched_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid2 = _errs17 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
}
}
}
else {
validate39.errors = [{instancePath:instancePath+"/evidence",schemaPath:"#/$defs/evidence/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs5 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
else {
validate39.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate39.errors = vErrors;
return errors === 0;
}
validate39.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

const pattern7 = new RegExp("^/(name|fields/[a-z]+/[0-9]+|via/related_claims/[0-9]+)$", "u");
const pattern9 = new RegExp("^(person|unit|project|infrastructure)-[a-z0-9-]+$", "u");

function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="result.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate20.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((((((data.query === undefined) && (missing0 = "query")) || ((data.mode === undefined) && (missing0 = "mode"))) || ((data.abstained === undefined) && (missing0 = "abstained"))) || ((data.results === undefined) && (missing0 = "results"))) || ((data.expanded_terms === undefined) && (missing0 = "expanded_terms"))) || ((data.versions === undefined) && (missing0 = "versions"))){
validate20.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!(func1.call(schema31.properties, key0))){
validate20.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.query !== undefined){
const _errs2 = errors;
if(typeof data.query !== "string"){
validate20.errors = [{instancePath:instancePath+"/query",schemaPath:"#/properties/query/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.brief_terms !== undefined){
let data1 = data.brief_terms;
const _errs4 = errors;
if(errors === _errs4){
if(Array.isArray(data1)){
var valid1 = true;
const len0 = data1.length;
for(let i0=0; i0<len0; i0++){
let data2 = data1[i0];
const _errs6 = errors;
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
let missing1;
if(((data2.term === undefined) && (missing1 = "term")) || ((data2.span === undefined) && (missing1 = "span"))){
validate20.errors = [{instancePath:instancePath+"/brief_terms/" + i0,schemaPath:"#/properties/brief_terms/items/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs8 = errors;
for(const key1 in data2){
if(!((key1 === "term") || (key1 === "span"))){
validate20.errors = [{instancePath:instancePath+"/brief_terms/" + i0,schemaPath:"#/properties/brief_terms/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs8 === errors){
if(data2.term !== undefined){
const _errs9 = errors;
if(typeof data2.term !== "string"){
validate20.errors = [{instancePath:instancePath+"/brief_terms/" + i0+"/term",schemaPath:"#/properties/brief_terms/items/properties/term/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs9 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data2.span !== undefined){
const _errs11 = errors;
if(typeof data2.span !== "string"){
validate20.errors = [{instancePath:instancePath+"/brief_terms/" + i0+"/span",schemaPath:"#/properties/brief_terms/items/properties/span/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid2 = _errs11 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/brief_terms/" + i0,schemaPath:"#/properties/brief_terms/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid1 = _errs6 === errors;
if(!valid1){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/brief_terms",schemaPath:"#/properties/brief_terms/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.mode !== undefined){
let data5 = data.mode;
const _errs13 = errors;
if(!(((data5 === "live") || (data5 === "replay")) || (data5 === "mock"))){
validate20.errors = [{instancePath:instancePath+"/mode",schemaPath:"#/properties/mode/enum",keyword:"enum",params:{allowedValues: schema31.properties.mode.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs13 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.abstained !== undefined){
const _errs14 = errors;
if(typeof data.abstained !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/abstained",schemaPath:"#/properties/abstained/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid0 = _errs14 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.abstain_reason !== undefined){
let data7 = data.abstain_reason;
const _errs16 = errors;
if(!((((data7 === "no_verifiable_source") || (data7 === "query_out_of_scope")) || (data7 === "engine_error")) || (data7 === null))){
validate20.errors = [{instancePath:instancePath+"/abstain_reason",schemaPath:"#/properties/abstain_reason/enum",keyword:"enum",params:{allowedValues: schema31.properties.abstain_reason.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs16 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.expanded_terms !== undefined){
let data8 = data.expanded_terms;
const _errs17 = errors;
if(errors === _errs17){
if(Array.isArray(data8)){
var valid3 = true;
const len1 = data8.length;
for(let i1=0; i1<len1; i1++){
let data9 = data8[i1];
const _errs19 = errors;
if(errors === _errs19){
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
let missing2;
if(((data9.term === undefined) && (missing2 = "term")) || ((data9.kind === undefined) && (missing2 = "kind"))){
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1,schemaPath:"#/properties/expanded_terms/items/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
const _errs21 = errors;
for(const key2 in data9){
if(!(((key2 === "term") || (key2 === "kind")) || (key2 === "lang"))){
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1,schemaPath:"#/properties/expanded_terms/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs21 === errors){
if(data9.term !== undefined){
const _errs22 = errors;
if(typeof data9.term !== "string"){
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1+"/term",schemaPath:"#/properties/expanded_terms/items/properties/term/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid4 = _errs22 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data9.kind !== undefined){
let data11 = data9.kind;
const _errs24 = errors;
if(!((((data11 === "synonym") || (data11 === "lay")) || (data11 === "translation")) || (data11 === "acronym"))){
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1+"/kind",schemaPath:"#/properties/expanded_terms/items/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.expanded_terms.items.properties.kind.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid4 = _errs24 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data9.lang !== undefined){
let data12 = data9.lang;
const _errs25 = errors;
if(!((((data12 === "de") || (data12 === "en")) || (data12 === "fr")) || (data12 === "it"))){
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1+"/lang",schemaPath:"#/properties/expanded_terms/items/properties/lang/enum",keyword:"enum",params:{allowedValues: schema31.properties.expanded_terms.items.properties.lang.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid4 = _errs25 === errors;
}
else {
var valid4 = true;
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/expanded_terms/" + i1,schemaPath:"#/properties/expanded_terms/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid3 = _errs19 === errors;
if(!valid3){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/expanded_terms",schemaPath:"#/properties/expanded_terms/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs17 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.results !== undefined){
let data13 = data.results;
const _errs26 = errors;
if(errors === _errs26){
if(Array.isArray(data13)){
if(data13.length > 50){
validate20.errors = [{instancePath:instancePath+"/results",schemaPath:"#/properties/results/maxItems",keyword:"maxItems",params:{limit: 50},message:"must NOT have more than 50 items"}];
return false;
}
else {
var valid5 = true;
const len2 = data13.length;
for(let i2=0; i2<len2; i2++){
let data14 = data13[i2];
const _errs28 = errors;
if(errors === _errs28){
if(data14 && typeof data14 == "object" && !Array.isArray(data14)){
let missing3;
if(((((data14.rank === undefined) && (missing3 = "rank")) || ((data14.profile === undefined) && (missing3 = "profile"))) || ((data14.reason === undefined) && (missing3 = "reason"))) || ((data14.score === undefined) && (missing3 = "score"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2,schemaPath:"#/properties/results/items/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
const _errs30 = errors;
for(const key3 in data14){
if(!(((((((key3 === "rank") || (key3 === "profile")) || (key3 === "reason")) || (key3 === "score")) || (key3 === "metrics")) || (key3 === "via")) || (key3 === "passage"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2,schemaPath:"#/properties/results/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs30 === errors){
if(data14.rank !== undefined){
let data15 = data14.rank;
const _errs31 = errors;
if(!(((typeof data15 == "number") && (!(data15 % 1) && !isNaN(data15))) && (isFinite(data15)))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/rank",schemaPath:"#/properties/results/items/properties/rank/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs31){
if((typeof data15 == "number") && (isFinite(data15))){
if(data15 < 1 || isNaN(data15)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/rank",schemaPath:"#/properties/results/items/properties/rank/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
}
var valid6 = _errs31 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.profile !== undefined){
const _errs33 = errors;
if(!(validate21(data14.profile, {instancePath:instancePath+"/results/" + i2+"/profile",parentData:data14,parentDataProperty:"profile",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
var valid6 = _errs33 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.reason !== undefined){
let data17 = data14.reason;
const _errs34 = errors;
if(errors === _errs34){
if(data17 && typeof data17 == "object" && !Array.isArray(data17)){
let missing4;
if(((data17.text === undefined) && (missing4 = "text")) || ((data17.cites === undefined) && (missing4 = "cites"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason",schemaPath:"#/properties/results/items/properties/reason/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
const _errs36 = errors;
for(const key4 in data17){
if(!((key4 === "text") || (key4 === "cites"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason",schemaPath:"#/properties/results/items/properties/reason/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs36 === errors){
if(data17.text !== undefined){
let data18 = data17.text;
const _errs37 = errors;
if(errors === _errs37){
if(typeof data18 === "string"){
if(func2(data18) > 400){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/text",schemaPath:"#/properties/results/items/properties/reason/properties/text/maxLength",keyword:"maxLength",params:{limit: 400},message:"must NOT have more than 400 characters"}];
return false;
}
else {
if(func2(data18) < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/text",schemaPath:"#/properties/results/items/properties/reason/properties/text/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/text",schemaPath:"#/properties/results/items/properties/reason/properties/text/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid7 = _errs37 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data17.cites !== undefined){
let data19 = data17.cites;
const _errs39 = errors;
if(errors === _errs39){
if(Array.isArray(data19)){
if(data19.length < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/cites",schemaPath:"#/properties/results/items/properties/reason/properties/cites/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"}];
return false;
}
else {
var valid8 = true;
const len3 = data19.length;
for(let i3=0; i3<len3; i3++){
let data20 = data19[i3];
const _errs41 = errors;
if(errors === _errs41){
if(typeof data20 === "string"){
if(!pattern7.test(data20)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/cites/" + i3,schemaPath:"#/properties/results/items/properties/reason/properties/cites/items/pattern",keyword:"pattern",params:{pattern: "^/(name|fields/[a-z]+/[0-9]+|via/related_claims/[0-9]+)$"},message:"must match pattern \""+"^/(name|fields/[a-z]+/[0-9]+|via/related_claims/[0-9]+)$"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/cites/" + i3,schemaPath:"#/properties/results/items/properties/reason/properties/cites/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid8 = _errs41 === errors;
if(!valid8){
break;
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason/cites",schemaPath:"#/properties/results/items/properties/reason/properties/cites/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid7 = _errs39 === errors;
}
else {
var valid7 = true;
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/reason",schemaPath:"#/properties/results/items/properties/reason/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs34 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.score !== undefined){
let data21 = data14.score;
const _errs43 = errors;
if(errors === _errs43){
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
let missing5;
if((data21.fused === undefined) && (missing5 = "fused")){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score",schemaPath:"#/properties/results/items/properties/score/required",keyword:"required",params:{missingProperty: missing5},message:"must have required property '"+missing5+"'"}];
return false;
}
else {
const _errs45 = errors;
for(const key5 in data21){
if(!(((key5 === "fused") || (key5 === "lexical_rank")) || (key5 === "vector_rank"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score",schemaPath:"#/properties/results/items/properties/score/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs45 === errors){
if(data21.fused !== undefined){
let data22 = data21.fused;
const _errs46 = errors;
if(!((typeof data22 == "number") && (isFinite(data22)))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score/fused",schemaPath:"#/properties/results/items/properties/score/properties/fused/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
var valid9 = _errs46 === errors;
}
else {
var valid9 = true;
}
if(valid9){
if(data21.lexical_rank !== undefined){
let data23 = data21.lexical_rank;
const _errs48 = errors;
if((!(((typeof data23 == "number") && (!(data23 % 1) && !isNaN(data23))) && (isFinite(data23)))) && (data23 !== null)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score/lexical_rank",schemaPath:"#/properties/results/items/properties/score/properties/lexical_rank/type",keyword:"type",params:{type: schema31.properties.results.items.properties.score.properties.lexical_rank.type},message:"must be integer,null"}];
return false;
}
var valid9 = _errs48 === errors;
}
else {
var valid9 = true;
}
if(valid9){
if(data21.vector_rank !== undefined){
let data24 = data21.vector_rank;
const _errs50 = errors;
if((!(((typeof data24 == "number") && (!(data24 % 1) && !isNaN(data24))) && (isFinite(data24)))) && (data24 !== null)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score/vector_rank",schemaPath:"#/properties/results/items/properties/score/properties/vector_rank/type",keyword:"type",params:{type: schema31.properties.results.items.properties.score.properties.vector_rank.type},message:"must be integer,null"}];
return false;
}
var valid9 = _errs50 === errors;
}
else {
var valid9 = true;
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/score",schemaPath:"#/properties/results/items/properties/score/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs43 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.metrics !== undefined){
let data25 = data14.metrics;
const _errs52 = errors;
if(errors === _errs52){
if(data25 && typeof data25 == "object" && !Array.isArray(data25)){
let missing6;
if((((((((data25.relevance === undefined) && (missing6 = "relevance")) || ((data25.covers === undefined) && (missing6 = "covers"))) || ((data25.missing === undefined) && (missing6 = "missing"))) || ((data25.evidence === undefined) && (missing6 = "evidence"))) || ((data25.completeness === undefined) && (missing6 = "completeness"))) || ((data25.novelty === undefined) && (missing6 = "novelty"))) || ((data25.confidence === undefined) && (missing6 = "confidence"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics",schemaPath:"#/properties/results/items/properties/metrics/required",keyword:"required",params:{missingProperty: missing6},message:"must have required property '"+missing6+"'"}];
return false;
}
else {
const _errs54 = errors;
for(const key6 in data25){
if(!(((((((key6 === "relevance") || (key6 === "evidence")) || (key6 === "confidence")) || (key6 === "covers")) || (key6 === "missing")) || (key6 === "completeness")) || (key6 === "novelty"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics",schemaPath:"#/properties/results/items/properties/metrics/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs54 === errors){
if(data25.relevance !== undefined){
let data26 = data25.relevance;
const _errs55 = errors;
if((!((typeof data26 == "number") && (isFinite(data26)))) && (data26 !== null)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/relevance",schemaPath:"#/properties/results/items/properties/metrics/properties/relevance/type",keyword:"type",params:{type: schema31.properties.results.items.properties.metrics.properties.relevance.type},message:"must be number,null"}];
return false;
}
if(errors === _errs55){
if((typeof data26 == "number") && (isFinite(data26))){
if(data26 > 1 || isNaN(data26)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/relevance",schemaPath:"#/properties/results/items/properties/metrics/properties/relevance/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data26 < 0 || isNaN(data26)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/relevance",schemaPath:"#/properties/results/items/properties/metrics/properties/relevance/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
}
var valid10 = _errs55 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.evidence !== undefined){
let data27 = data25.evidence;
const _errs57 = errors;
if((!((typeof data27 == "number") && (isFinite(data27)))) && (data27 !== null)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/evidence",schemaPath:"#/properties/results/items/properties/metrics/properties/evidence/type",keyword:"type",params:{type: schema31.properties.results.items.properties.metrics.properties.evidence.type},message:"must be number,null"}];
return false;
}
if(errors === _errs57){
if((typeof data27 == "number") && (isFinite(data27))){
if(data27 > 1 || isNaN(data27)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/evidence",schemaPath:"#/properties/results/items/properties/metrics/properties/evidence/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data27 < 0 || isNaN(data27)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/evidence",schemaPath:"#/properties/results/items/properties/metrics/properties/evidence/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
}
var valid10 = _errs57 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.confidence !== undefined){
let data28 = data25.confidence;
const _errs59 = errors;
if((!((typeof data28 == "number") && (isFinite(data28)))) && (data28 !== null)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/confidence",schemaPath:"#/properties/results/items/properties/metrics/properties/confidence/type",keyword:"type",params:{type: schema31.properties.results.items.properties.metrics.properties.confidence.type},message:"must be number,null"}];
return false;
}
if(errors === _errs59){
if((typeof data28 == "number") && (isFinite(data28))){
if(data28 > 1 || isNaN(data28)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/confidence",schemaPath:"#/properties/results/items/properties/metrics/properties/confidence/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data28 < 0 || isNaN(data28)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/confidence",schemaPath:"#/properties/results/items/properties/metrics/properties/confidence/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
}
var valid10 = _errs59 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.covers !== undefined){
let data29 = data25.covers;
const _errs61 = errors;
if(errors === _errs61){
if(Array.isArray(data29)){
var valid11 = true;
const len4 = data29.length;
for(let i4=0; i4<len4; i4++){
const _errs63 = errors;
if(typeof data29[i4] !== "string"){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/covers/" + i4,schemaPath:"#/properties/results/items/properties/metrics/properties/covers/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid11 = _errs63 === errors;
if(!valid11){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/covers",schemaPath:"#/properties/results/items/properties/metrics/properties/covers/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid10 = _errs61 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.missing !== undefined){
let data31 = data25.missing;
const _errs65 = errors;
if(errors === _errs65){
if(Array.isArray(data31)){
var valid12 = true;
const len5 = data31.length;
for(let i5=0; i5<len5; i5++){
const _errs67 = errors;
if(typeof data31[i5] !== "string"){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/missing/" + i5,schemaPath:"#/properties/results/items/properties/metrics/properties/missing/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid12 = _errs67 === errors;
if(!valid12){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/missing",schemaPath:"#/properties/results/items/properties/metrics/properties/missing/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid10 = _errs65 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.completeness !== undefined){
let data33 = data25.completeness;
const _errs69 = errors;
if(errors === _errs69){
if(data33 && typeof data33 == "object" && !Array.isArray(data33)){
let missing7;
if(((data33.filled === undefined) && (missing7 = "filled")) || ((data33.of === undefined) && (missing7 = "of"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/required",keyword:"required",params:{missingProperty: missing7},message:"must have required property '"+missing7+"'"}];
return false;
}
else {
const _errs71 = errors;
for(const key7 in data33){
if(!((key7 === "filled") || (key7 === "of"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key7},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs71 === errors){
if(data33.filled !== undefined){
let data34 = data33.filled;
const _errs72 = errors;
if(!(((typeof data34 == "number") && (!(data34 % 1) && !isNaN(data34))) && (isFinite(data34)))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness/filled",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/properties/filled/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs72){
if((typeof data34 == "number") && (isFinite(data34))){
if(data34 < 0 || isNaN(data34)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness/filled",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/properties/filled/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid13 = _errs72 === errors;
}
else {
var valid13 = true;
}
if(valid13){
if(data33.of !== undefined){
const _errs74 = errors;
if(5 !== data33.of){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness/of",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/properties/of/const",keyword:"const",params:{allowedValue: 5},message:"must be equal to constant"}];
return false;
}
var valid13 = _errs74 === errors;
}
else {
var valid13 = true;
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/completeness",schemaPath:"#/properties/results/items/properties/metrics/properties/completeness/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid10 = _errs69 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data25.novelty !== undefined){
let data36 = data25.novelty;
const _errs75 = errors;
if(errors === _errs75){
if(data36 && typeof data36 == "object" && !Array.isArray(data36)){
let missing8;
if(((data36.new_unit === undefined) && (missing8 = "new_unit")) || ((data36.adds === undefined) && (missing8 = "adds"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty",schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/required",keyword:"required",params:{missingProperty: missing8},message:"must have required property '"+missing8+"'"}];
return false;
}
else {
const _errs77 = errors;
for(const key8 in data36){
if(!((key8 === "new_unit") || (key8 === "adds"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty",schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key8},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs77 === errors){
if(data36.new_unit !== undefined){
const _errs78 = errors;
if(typeof data36.new_unit !== "boolean"){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty/new_unit",schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/properties/new_unit/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid14 = _errs78 === errors;
}
else {
var valid14 = true;
}
if(valid14){
if(data36.adds !== undefined){
let data38 = data36.adds;
const _errs80 = errors;
if(errors === _errs80){
if(Array.isArray(data38)){
var valid15 = true;
const len6 = data38.length;
for(let i6=0; i6<len6; i6++){
const _errs82 = errors;
if(typeof data38[i6] !== "string"){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty/adds/" + i6,schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/properties/adds/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid15 = _errs82 === errors;
if(!valid15){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty/adds",schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/properties/adds/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid14 = _errs80 === errors;
}
else {
var valid14 = true;
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics/novelty",schemaPath:"#/properties/results/items/properties/metrics/properties/novelty/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid10 = _errs75 === errors;
}
else {
var valid10 = true;
}
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/metrics",schemaPath:"#/properties/results/items/properties/metrics/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs52 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.via !== undefined){
let data40 = data14.via;
const _errs84 = errors;
if(errors === _errs84){
if(data40 && typeof data40 == "object" && !Array.isArray(data40)){
let missing9;
if((((((((data40.kind === undefined) && (missing9 = "kind")) || ((data40.span === undefined) && (missing9 = "span"))) || ((data40.page_url === undefined) && (missing9 = "page_url"))) || ((data40.page_sha256 === undefined) && (missing9 = "page_sha256"))) || ((data40.related_profile_id === undefined) && (missing9 = "related_profile_id"))) || ((data40.related_name === undefined) && (missing9 = "related_name"))) || ((data40.related_claims === undefined) && (missing9 = "related_claims"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via",schemaPath:"#/properties/results/items/properties/via/required",keyword:"required",params:{missingProperty: missing9},message:"must have required property '"+missing9+"'"}];
return false;
}
else {
const _errs86 = errors;
for(const key9 in data40){
if(!(func1.call(schema31.properties.results.items.properties.via.properties, key9))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via",schemaPath:"#/properties/results/items/properties/via/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key9},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs86 === errors){
if(data40.kind !== undefined){
let data41 = data40.kind;
const _errs87 = errors;
if(!(((data41 === "leads") || (data41 === "works_on")) || (data41 === "member_of"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/kind",schemaPath:"#/properties/results/items/properties/via/properties/kind/enum",keyword:"enum",params:{allowedValues: schema31.properties.results.items.properties.via.properties.kind.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid16 = _errs87 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.span !== undefined){
let data42 = data40.span;
const _errs88 = errors;
if(errors === _errs88){
if(typeof data42 === "string"){
if(func2(data42) > 300){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/span",schemaPath:"#/properties/results/items/properties/via/properties/span/maxLength",keyword:"maxLength",params:{limit: 300},message:"must NOT have more than 300 characters"}];
return false;
}
else {
if(func2(data42) < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/span",schemaPath:"#/properties/results/items/properties/via/properties/span/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/span",schemaPath:"#/properties/results/items/properties/via/properties/span/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid16 = _errs88 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.page_url !== undefined){
let data43 = data40.page_url;
const _errs90 = errors;
if(errors === _errs90){
if(errors === _errs90){
if(typeof data43 === "string"){
if(!(formats0(data43))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/page_url",schemaPath:"#/properties/results/items/properties/via/properties/page_url/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/page_url",schemaPath:"#/properties/results/items/properties/via/properties/page_url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid16 = _errs90 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.page_sha256 !== undefined){
let data44 = data40.page_sha256;
const _errs92 = errors;
if(errors === _errs92){
if(typeof data44 === "string"){
if(!pattern6.test(data44)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/page_sha256",schemaPath:"#/properties/results/items/properties/via/properties/page_sha256/pattern",keyword:"pattern",params:{pattern: "^[0-9a-f]{64}$"},message:"must match pattern \""+"^[0-9a-f]{64}$"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/page_sha256",schemaPath:"#/properties/results/items/properties/via/properties/page_sha256/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid16 = _errs92 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.start !== undefined){
let data45 = data40.start;
const _errs94 = errors;
if(!(((typeof data45 == "number") && (!(data45 % 1) && !isNaN(data45))) && (isFinite(data45)))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/start",schemaPath:"#/properties/results/items/properties/via/properties/start/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs94){
if((typeof data45 == "number") && (isFinite(data45))){
if(data45 < 0 || isNaN(data45)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/start",schemaPath:"#/properties/results/items/properties/via/properties/start/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid16 = _errs94 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.fetched_at !== undefined){
let data46 = data40.fetched_at;
const _errs96 = errors;
if(errors === _errs96){
if(errors === _errs96){
if(typeof data46 === "string"){
if(!(formats2.validate(data46))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/fetched_at",schemaPath:"#/properties/results/items/properties/via/properties/fetched_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/fetched_at",schemaPath:"#/properties/results/items/properties/via/properties/fetched_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid16 = _errs96 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.related_profile_id !== undefined){
let data47 = data40.related_profile_id;
const _errs98 = errors;
if(errors === _errs98){
if(typeof data47 === "string"){
if(!pattern9.test(data47)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_profile_id",schemaPath:"#/properties/results/items/properties/via/properties/related_profile_id/pattern",keyword:"pattern",params:{pattern: "^(person|unit|project|infrastructure)-[a-z0-9-]+$"},message:"must match pattern \""+"^(person|unit|project|infrastructure)-[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_profile_id",schemaPath:"#/properties/results/items/properties/via/properties/related_profile_id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid16 = _errs98 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.related_name !== undefined){
let data48 = data40.related_name;
const _errs100 = errors;
if(errors === _errs100){
if(typeof data48 === "string"){
if(func2(data48) < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_name",schemaPath:"#/properties/results/items/properties/via/properties/related_name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_name",schemaPath:"#/properties/results/items/properties/via/properties/related_name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid16 = _errs100 === errors;
}
else {
var valid16 = true;
}
if(valid16){
if(data40.related_claims !== undefined){
let data49 = data40.related_claims;
const _errs102 = errors;
if(errors === _errs102){
if(Array.isArray(data49)){
if(data49.length < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_claims",schemaPath:"#/properties/results/items/properties/via/properties/related_claims/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"}];
return false;
}
else {
var valid17 = true;
const len7 = data49.length;
for(let i7=0; i7<len7; i7++){
const _errs104 = errors;
if(!(validate39(data49[i7], {instancePath:instancePath+"/results/" + i2+"/via/related_claims/" + i7,parentData:data49,parentDataProperty:i7,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate39.errors : vErrors.concat(validate39.errors);
errors = vErrors.length;
}
var valid17 = _errs104 === errors;
if(!valid17){
break;
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via/related_claims",schemaPath:"#/properties/results/items/properties/via/properties/related_claims/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid16 = _errs102 === errors;
}
else {
var valid16 = true;
}
}
}
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/via",schemaPath:"#/properties/results/items/properties/via/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs84 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data14.passage !== undefined){
let data51 = data14.passage;
const _errs105 = errors;
if(errors === _errs105){
if(data51 && typeof data51 == "object" && !Array.isArray(data51)){
let missing10;
if(((((((data51.kind === undefined) && (missing10 = "kind")) || ((data51.span === undefined) && (missing10 = "span"))) || ((data51.page_url === undefined) && (missing10 = "page_url"))) || ((data51.page_sha256 === undefined) && (missing10 = "page_sha256"))) || ((data51.start === undefined) && (missing10 = "start"))) || ((data51.fetched_at === undefined) && (missing10 = "fetched_at"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage",schemaPath:"#/properties/results/items/properties/passage/required",keyword:"required",params:{missingProperty: missing10},message:"must have required property '"+missing10+"'"}];
return false;
}
else {
const _errs107 = errors;
for(const key10 in data51){
if(!((((((key10 === "kind") || (key10 === "span")) || (key10 === "page_url")) || (key10 === "page_sha256")) || (key10 === "start")) || (key10 === "fetched_at"))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage",schemaPath:"#/properties/results/items/properties/passage/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key10},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs107 === errors){
if(data51.kind !== undefined){
const _errs108 = errors;
if("own_page" !== data51.kind){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/kind",schemaPath:"#/properties/results/items/properties/passage/properties/kind/const",keyword:"const",params:{allowedValue: "own_page"},message:"must be equal to constant"}];
return false;
}
var valid18 = _errs108 === errors;
}
else {
var valid18 = true;
}
if(valid18){
if(data51.span !== undefined){
let data53 = data51.span;
const _errs109 = errors;
if(errors === _errs109){
if(typeof data53 === "string"){
if(func2(data53) > 600){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/span",schemaPath:"#/properties/results/items/properties/passage/properties/span/maxLength",keyword:"maxLength",params:{limit: 600},message:"must NOT have more than 600 characters"}];
return false;
}
else {
if(func2(data53) < 1){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/span",schemaPath:"#/properties/results/items/properties/passage/properties/span/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/span",schemaPath:"#/properties/results/items/properties/passage/properties/span/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid18 = _errs109 === errors;
}
else {
var valid18 = true;
}
if(valid18){
if(data51.page_url !== undefined){
let data54 = data51.page_url;
const _errs111 = errors;
if(errors === _errs111){
if(errors === _errs111){
if(typeof data54 === "string"){
if(!(formats0(data54))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/page_url",schemaPath:"#/properties/results/items/properties/passage/properties/page_url/format",keyword:"format",params:{format: "uri"},message:"must match format \""+"uri"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/page_url",schemaPath:"#/properties/results/items/properties/passage/properties/page_url/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid18 = _errs111 === errors;
}
else {
var valid18 = true;
}
if(valid18){
if(data51.page_sha256 !== undefined){
let data55 = data51.page_sha256;
const _errs113 = errors;
if(errors === _errs113){
if(typeof data55 === "string"){
if(!pattern6.test(data55)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/page_sha256",schemaPath:"#/properties/results/items/properties/passage/properties/page_sha256/pattern",keyword:"pattern",params:{pattern: "^[0-9a-f]{64}$"},message:"must match pattern \""+"^[0-9a-f]{64}$"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/page_sha256",schemaPath:"#/properties/results/items/properties/passage/properties/page_sha256/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid18 = _errs113 === errors;
}
else {
var valid18 = true;
}
if(valid18){
if(data51.start !== undefined){
let data56 = data51.start;
const _errs115 = errors;
if(!(((typeof data56 == "number") && (!(data56 % 1) && !isNaN(data56))) && (isFinite(data56)))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/start",schemaPath:"#/properties/results/items/properties/passage/properties/start/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs115){
if((typeof data56 == "number") && (isFinite(data56))){
if(data56 < 0 || isNaN(data56)){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/start",schemaPath:"#/properties/results/items/properties/passage/properties/start/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid18 = _errs115 === errors;
}
else {
var valid18 = true;
}
if(valid18){
if(data51.fetched_at !== undefined){
let data57 = data51.fetched_at;
const _errs117 = errors;
if(errors === _errs117){
if(errors === _errs117){
if(typeof data57 === "string"){
if(!(formats2.validate(data57))){
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/fetched_at",schemaPath:"#/properties/results/items/properties/passage/properties/fetched_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage/fetched_at",schemaPath:"#/properties/results/items/properties/passage/properties/fetched_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid18 = _errs117 === errors;
}
else {
var valid18 = true;
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2+"/passage",schemaPath:"#/properties/results/items/properties/passage/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid6 = _errs105 === errors;
}
else {
var valid6 = true;
}
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results/" + i2,schemaPath:"#/properties/results/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid5 = _errs28 === errors;
if(!valid5){
break;
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/results",schemaPath:"#/properties/results/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs26 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.timings_ms !== undefined){
let data58 = data.timings_ms;
const _errs119 = errors;
if(errors === _errs119){
if(data58 && typeof data58 == "object" && !Array.isArray(data58)){
for(const key11 in data58){
let data59 = data58[key11];
const _errs122 = errors;
if(!((typeof data59 == "number") && (isFinite(data59)))){
validate20.errors = [{instancePath:instancePath+"/timings_ms/" + key11.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/timings_ms/additionalProperties/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
var valid19 = _errs122 === errors;
if(!valid19){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/timings_ms",schemaPath:"#/properties/timings_ms/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs119 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.versions !== undefined){
let data60 = data.versions;
const _errs124 = errors;
if(errors === _errs124){
if(data60 && typeof data60 == "object" && !Array.isArray(data60)){
let missing11;
if((((data60.engine === undefined) && (missing11 = "engine")) || ((data60.snapshot === undefined) && (missing11 = "snapshot"))) || ((data60.prompts === undefined) && (missing11 = "prompts"))){
validate20.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/required",keyword:"required",params:{missingProperty: missing11},message:"must have required property '"+missing11+"'"}];
return false;
}
else {
const _errs126 = errors;
for(const key12 in data60){
if(!((((key12 === "engine") || (key12 === "snapshot")) || (key12 === "prompts")) || (key12 === "models"))){
validate20.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key12},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs126 === errors){
if(data60.engine !== undefined){
const _errs127 = errors;
if(typeof data60.engine !== "string"){
validate20.errors = [{instancePath:instancePath+"/versions/engine",schemaPath:"#/properties/versions/properties/engine/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid20 = _errs127 === errors;
}
else {
var valid20 = true;
}
if(valid20){
if(data60.snapshot !== undefined){
const _errs129 = errors;
if(typeof data60.snapshot !== "string"){
validate20.errors = [{instancePath:instancePath+"/versions/snapshot",schemaPath:"#/properties/versions/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid20 = _errs129 === errors;
}
else {
var valid20 = true;
}
if(valid20){
if(data60.prompts !== undefined){
const _errs131 = errors;
if(typeof data60.prompts !== "string"){
validate20.errors = [{instancePath:instancePath+"/versions/prompts",schemaPath:"#/properties/versions/properties/prompts/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid20 = _errs131 === errors;
}
else {
var valid20 = true;
}
if(valid20){
if(data60.models !== undefined){
let data64 = data60.models;
const _errs133 = errors;
if(errors === _errs133){
if(data64 && typeof data64 == "object" && !Array.isArray(data64)){
for(const key13 in data64){
const _errs136 = errors;
if(typeof data64[key13] !== "string"){
validate20.errors = [{instancePath:instancePath+"/versions/models/" + key13.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/versions/properties/models/additionalProperties/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid21 = _errs136 === errors;
if(!valid21){
break;
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/versions/models",schemaPath:"#/properties/versions/properties/models/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid20 = _errs133 === errors;
}
else {
var valid20 = true;
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs124 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
}
}
}
else {
validate20.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate20.errors = vErrors;
return errors === 0;
}
validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isHealth = validate41;
const schema38 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"health.schema.json","title":"Health","description":"GET /api/health. The HUD shows only counts present here; a missing count is not shown, never guessed.","type":"object","required":["mode","snapshot","counts"],"additionalProperties":false,"properties":{"mode":{"enum":["live","replay","mock"]},"models":{"type":"object","additionalProperties":{"type":"string"}},"snapshot":{"type":"string"},"counts":{"type":"object","additionalProperties":false,"properties":{"pages":{"type":"integer","minimum":0},"profiles":{"type":"integer","minimum":0},"sources":{"type":"integer","minimum":0}}},"status":{"description":"degraded when a model call failed in the last hour, or when the mode is live and today's call budget is used up.","enum":["ok","degraded"]},"uptime_s":{"type":"integer","minimum":0},"failures_last_hour":{"description":"Failed model calls in the last hour, counted per role and failure marker. Roles and markers only, never error text.","type":"object","propertyNames":{"pattern":"^[a-z_]+$","maxLength":32},"additionalProperties":{"type":"object","propertyNames":{"pattern":"^[a-z0-9_]+$","maxLength":32},"additionalProperties":{"type":"integer","minimum":1}}},"budget":{"description":"Live model calls allowed and used today (UTC day). Absent when the mode is not live.","type":"object","required":["limit","used"],"additionalProperties":false,"properties":{"limit":{"type":"integer","minimum":0},"used":{"type":"integer","minimum":0}}}}};
const pattern12 = new RegExp("^[a-z_]+$", "u");
const pattern13 = new RegExp("^[a-z0-9_]+$", "u");

function validate41(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="health.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate41.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((data.mode === undefined) && (missing0 = "mode")) || ((data.snapshot === undefined) && (missing0 = "snapshot"))) || ((data.counts === undefined) && (missing0 = "counts"))){
validate41.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((((((((key0 === "mode") || (key0 === "models")) || (key0 === "snapshot")) || (key0 === "counts")) || (key0 === "status")) || (key0 === "uptime_s")) || (key0 === "failures_last_hour")) || (key0 === "budget"))){
validate41.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.mode !== undefined){
let data0 = data.mode;
const _errs2 = errors;
if(!(((data0 === "live") || (data0 === "replay")) || (data0 === "mock"))){
validate41.errors = [{instancePath:instancePath+"/mode",schemaPath:"#/properties/mode/enum",keyword:"enum",params:{allowedValues: schema38.properties.mode.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.models !== undefined){
let data1 = data.models;
const _errs3 = errors;
if(errors === _errs3){
if(data1 && typeof data1 == "object" && !Array.isArray(data1)){
for(const key1 in data1){
const _errs6 = errors;
if(typeof data1[key1] !== "string"){
validate41.errors = [{instancePath:instancePath+"/models/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/models/additionalProperties/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid1 = _errs6 === errors;
if(!valid1){
break;
}
}
}
else {
validate41.errors = [{instancePath:instancePath+"/models",schemaPath:"#/properties/models/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs3 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.snapshot !== undefined){
const _errs8 = errors;
if(typeof data.snapshot !== "string"){
validate41.errors = [{instancePath:instancePath+"/snapshot",schemaPath:"#/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs8 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.counts !== undefined){
let data4 = data.counts;
const _errs10 = errors;
if(errors === _errs10){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
const _errs12 = errors;
for(const key2 in data4){
if(!(((key2 === "pages") || (key2 === "profiles")) || (key2 === "sources"))){
validate41.errors = [{instancePath:instancePath+"/counts",schemaPath:"#/properties/counts/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs12 === errors){
if(data4.pages !== undefined){
let data5 = data4.pages;
const _errs13 = errors;
if(!(((typeof data5 == "number") && (!(data5 % 1) && !isNaN(data5))) && (isFinite(data5)))){
validate41.errors = [{instancePath:instancePath+"/counts/pages",schemaPath:"#/properties/counts/properties/pages/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs13){
if((typeof data5 == "number") && (isFinite(data5))){
if(data5 < 0 || isNaN(data5)){
validate41.errors = [{instancePath:instancePath+"/counts/pages",schemaPath:"#/properties/counts/properties/pages/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid2 = _errs13 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data4.profiles !== undefined){
let data6 = data4.profiles;
const _errs15 = errors;
if(!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))){
validate41.errors = [{instancePath:instancePath+"/counts/profiles",schemaPath:"#/properties/counts/properties/profiles/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs15){
if((typeof data6 == "number") && (isFinite(data6))){
if(data6 < 0 || isNaN(data6)){
validate41.errors = [{instancePath:instancePath+"/counts/profiles",schemaPath:"#/properties/counts/properties/profiles/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid2 = _errs15 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data4.sources !== undefined){
let data7 = data4.sources;
const _errs17 = errors;
if(!(((typeof data7 == "number") && (!(data7 % 1) && !isNaN(data7))) && (isFinite(data7)))){
validate41.errors = [{instancePath:instancePath+"/counts/sources",schemaPath:"#/properties/counts/properties/sources/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs17){
if((typeof data7 == "number") && (isFinite(data7))){
if(data7 < 0 || isNaN(data7)){
validate41.errors = [{instancePath:instancePath+"/counts/sources",schemaPath:"#/properties/counts/properties/sources/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid2 = _errs17 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
else {
validate41.errors = [{instancePath:instancePath+"/counts",schemaPath:"#/properties/counts/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs10 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.status !== undefined){
let data8 = data.status;
const _errs19 = errors;
if(!((data8 === "ok") || (data8 === "degraded"))){
validate41.errors = [{instancePath:instancePath+"/status",schemaPath:"#/properties/status/enum",keyword:"enum",params:{allowedValues: schema38.properties.status.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs19 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.uptime_s !== undefined){
let data9 = data.uptime_s;
const _errs20 = errors;
if(!(((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9))) && (isFinite(data9)))){
validate41.errors = [{instancePath:instancePath+"/uptime_s",schemaPath:"#/properties/uptime_s/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs20){
if((typeof data9 == "number") && (isFinite(data9))){
if(data9 < 0 || isNaN(data9)){
validate41.errors = [{instancePath:instancePath+"/uptime_s",schemaPath:"#/properties/uptime_s/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs20 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.failures_last_hour !== undefined){
let data10 = data.failures_last_hour;
const _errs22 = errors;
if(errors === _errs22){
if(data10 && typeof data10 == "object" && !Array.isArray(data10)){
for(const key3 in data10){
const _errs24 = errors;
if(typeof key3 === "string"){
if(func2(key3) > 32){
const err0 = {instancePath:instancePath+"/failures_last_hour",schemaPath:"#/properties/failures_last_hour/propertyNames/maxLength",keyword:"maxLength",params:{limit: 32},message:"must NOT have more than 32 characters",propertyName:key3};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
else {
if(!pattern12.test(key3)){
const err1 = {instancePath:instancePath+"/failures_last_hour",schemaPath:"#/properties/failures_last_hour/propertyNames/pattern",keyword:"pattern",params:{pattern: "^[a-z_]+$"},message:"must match pattern \""+"^[a-z_]+$"+"\"",propertyName:key3};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
}
}
}
var valid3 = _errs24 === errors;
if(!valid3){
const err2 = {instancePath:instancePath+"/failures_last_hour",schemaPath:"#/properties/failures_last_hour/propertyNames",keyword:"propertyNames",params:{propertyName: key3},message:"property name must be valid"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
validate41.errors = vErrors;
return false;
break;
}
}
if(valid3){
for(const key4 in data10){
let data11 = data10[key4];
const _errs26 = errors;
if(errors === _errs26){
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
for(const key5 in data11){
const _errs28 = errors;
if(typeof key5 === "string"){
if(func2(key5) > 32){
const err3 = {instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/propertyNames/maxLength",keyword:"maxLength",params:{limit: 32},message:"must NOT have more than 32 characters",propertyName:key5};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
else {
if(!pattern13.test(key5)){
const err4 = {instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/propertyNames/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9_]+$"},message:"must match pattern \""+"^[a-z0-9_]+$"+"\"",propertyName:key5};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
}
}
var valid5 = _errs28 === errors;
if(!valid5){
const err5 = {instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/propertyNames",keyword:"propertyNames",params:{propertyName: key5},message:"property name must be valid"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
validate41.errors = vErrors;
return false;
break;
}
}
if(valid5){
for(const key6 in data11){
let data12 = data11[key6];
const _errs30 = errors;
if(!(((typeof data12 == "number") && (!(data12 % 1) && !isNaN(data12))) && (isFinite(data12)))){
validate41.errors = [{instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1")+"/" + key6.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/additionalProperties/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs30){
if((typeof data12 == "number") && (isFinite(data12))){
if(data12 < 1 || isNaN(data12)){
validate41.errors = [{instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1")+"/" + key6.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/additionalProperties/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
}
var valid6 = _errs30 === errors;
if(!valid6){
break;
}
}
}
}
else {
validate41.errors = [{instancePath:instancePath+"/failures_last_hour/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/failures_last_hour/additionalProperties/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid4 = _errs26 === errors;
if(!valid4){
break;
}
}
}
}
else {
validate41.errors = [{instancePath:instancePath+"/failures_last_hour",schemaPath:"#/properties/failures_last_hour/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs22 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.budget !== undefined){
let data13 = data.budget;
const _errs32 = errors;
if(errors === _errs32){
if(data13 && typeof data13 == "object" && !Array.isArray(data13)){
let missing1;
if(((data13.limit === undefined) && (missing1 = "limit")) || ((data13.used === undefined) && (missing1 = "used"))){
validate41.errors = [{instancePath:instancePath+"/budget",schemaPath:"#/properties/budget/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs34 = errors;
for(const key7 in data13){
if(!((key7 === "limit") || (key7 === "used"))){
validate41.errors = [{instancePath:instancePath+"/budget",schemaPath:"#/properties/budget/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key7},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs34 === errors){
if(data13.limit !== undefined){
let data14 = data13.limit;
const _errs35 = errors;
if(!(((typeof data14 == "number") && (!(data14 % 1) && !isNaN(data14))) && (isFinite(data14)))){
validate41.errors = [{instancePath:instancePath+"/budget/limit",schemaPath:"#/properties/budget/properties/limit/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs35){
if((typeof data14 == "number") && (isFinite(data14))){
if(data14 < 0 || isNaN(data14)){
validate41.errors = [{instancePath:instancePath+"/budget/limit",schemaPath:"#/properties/budget/properties/limit/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid7 = _errs35 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data13.used !== undefined){
let data15 = data13.used;
const _errs37 = errors;
if(!(((typeof data15 == "number") && (!(data15 % 1) && !isNaN(data15))) && (isFinite(data15)))){
validate41.errors = [{instancePath:instancePath+"/budget/used",schemaPath:"#/properties/budget/properties/used/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs37){
if((typeof data15 == "number") && (isFinite(data15))){
if(data15 < 0 || isNaN(data15)){
validate41.errors = [{instancePath:instancePath+"/budget/used",schemaPath:"#/properties/budget/properties/used/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid7 = _errs37 === errors;
}
else {
var valid7 = true;
}
}
}
}
}
else {
validate41.errors = [{instancePath:instancePath+"/budget",schemaPath:"#/properties/budget/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs32 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
}
}
else {
validate41.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate41.errors = vErrors;
return errors === 0;
}
validate41.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isStory = validate42;
const schema39 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"quest.schema.json","title":"Story","description":"Story mode: a guided journey whose quests complete only on app events, never by self-report. Each quest names the case criterion it demonstrates.","type":"object","required":["id","title","quests"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z0-9-]+$"},"title":{"type":"string"},"quests":{"type":"array","minItems":1,"items":{"type":"object","required":["id","title","goal","criterion","steps"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z0-9-]+$"},"title":{"type":"string","maxLength":60},"goal":{"type":"string","maxLength":200},"criterion":{"enum":["c1-right-people","c2-wording","c3-traceable","c4-structured","c5-sources","c6-extend","ethics-abstain","stretch"]},"optional":{"description":"Not needed to finish the story; its steps may complete in any order.","type":"boolean"},"coming":{"description":"One line for the player: why the quest cannot be played yet. Shown while a step's event is not emitted by any feature.","type":"string","maxLength":120},"steps":{"type":"array","minItems":1,"items":{"type":"object","required":["id","text","done_when"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z0-9-]+$"},"text":{"type":"string","maxLength":160},"hint":{"description":"What the floatie says if the player asks.","type":"string","maxLength":240},"done_when":{"enum":["settled","office_ready","search_answered","search_answered_other_language","brief_answered","evidence_opened","report_made","lobby_entered","abstained_seen","source_added","numbers_seen","opportunity_saved","connection_saved","library_item_saved","message_sent","garage_visited"]}}}}}}}}};

function validate42(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="quest.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate42.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((data.id === undefined) && (missing0 = "id")) || ((data.title === undefined) && (missing0 = "title"))) || ((data.quests === undefined) && (missing0 = "quests"))){
validate42.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!(((key0 === "id") || (key0 === "title")) || (key0 === "quests"))){
validate42.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.id !== undefined){
let data0 = data.id;
const _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(!pattern5.test(data0)){
validate42.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9-]+$"},message:"must match pattern \""+"^[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/id",schemaPath:"#/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.title !== undefined){
const _errs4 = errors;
if(typeof data.title !== "string"){
validate42.errors = [{instancePath:instancePath+"/title",schemaPath:"#/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.quests !== undefined){
let data2 = data.quests;
const _errs6 = errors;
if(errors === _errs6){
if(Array.isArray(data2)){
if(data2.length < 1){
validate42.errors = [{instancePath:instancePath+"/quests",schemaPath:"#/properties/quests/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"}];
return false;
}
else {
var valid1 = true;
const len0 = data2.length;
for(let i0=0; i0<len0; i0++){
let data3 = data2[i0];
const _errs8 = errors;
if(errors === _errs8){
if(data3 && typeof data3 == "object" && !Array.isArray(data3)){
let missing1;
if((((((data3.id === undefined) && (missing1 = "id")) || ((data3.title === undefined) && (missing1 = "title"))) || ((data3.goal === undefined) && (missing1 = "goal"))) || ((data3.criterion === undefined) && (missing1 = "criterion"))) || ((data3.steps === undefined) && (missing1 = "steps"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0,schemaPath:"#/properties/quests/items/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs10 = errors;
for(const key1 in data3){
if(!(((((((key1 === "id") || (key1 === "title")) || (key1 === "goal")) || (key1 === "criterion")) || (key1 === "optional")) || (key1 === "coming")) || (key1 === "steps"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0,schemaPath:"#/properties/quests/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs10 === errors){
if(data3.id !== undefined){
let data4 = data3.id;
const _errs11 = errors;
if(errors === _errs11){
if(typeof data4 === "string"){
if(!pattern5.test(data4)){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/id",schemaPath:"#/properties/quests/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9-]+$"},message:"must match pattern \""+"^[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/id",schemaPath:"#/properties/quests/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs11 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.title !== undefined){
let data5 = data3.title;
const _errs13 = errors;
if(errors === _errs13){
if(typeof data5 === "string"){
if(func2(data5) > 60){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/title",schemaPath:"#/properties/quests/items/properties/title/maxLength",keyword:"maxLength",params:{limit: 60},message:"must NOT have more than 60 characters"}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/title",schemaPath:"#/properties/quests/items/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs13 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.goal !== undefined){
let data6 = data3.goal;
const _errs15 = errors;
if(errors === _errs15){
if(typeof data6 === "string"){
if(func2(data6) > 200){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/goal",schemaPath:"#/properties/quests/items/properties/goal/maxLength",keyword:"maxLength",params:{limit: 200},message:"must NOT have more than 200 characters"}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/goal",schemaPath:"#/properties/quests/items/properties/goal/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs15 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.criterion !== undefined){
let data7 = data3.criterion;
const _errs17 = errors;
if(!((((((((data7 === "c1-right-people") || (data7 === "c2-wording")) || (data7 === "c3-traceable")) || (data7 === "c4-structured")) || (data7 === "c5-sources")) || (data7 === "c6-extend")) || (data7 === "ethics-abstain")) || (data7 === "stretch"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/criterion",schemaPath:"#/properties/quests/items/properties/criterion/enum",keyword:"enum",params:{allowedValues: schema39.properties.quests.items.properties.criterion.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid2 = _errs17 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.optional !== undefined){
const _errs18 = errors;
if(typeof data3.optional !== "boolean"){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/optional",schemaPath:"#/properties/quests/items/properties/optional/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid2 = _errs18 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.coming !== undefined){
let data9 = data3.coming;
const _errs20 = errors;
if(errors === _errs20){
if(typeof data9 === "string"){
if(func2(data9) > 120){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/coming",schemaPath:"#/properties/quests/items/properties/coming/maxLength",keyword:"maxLength",params:{limit: 120},message:"must NOT have more than 120 characters"}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/coming",schemaPath:"#/properties/quests/items/properties/coming/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid2 = _errs20 === errors;
}
else {
var valid2 = true;
}
if(valid2){
if(data3.steps !== undefined){
let data10 = data3.steps;
const _errs22 = errors;
if(errors === _errs22){
if(Array.isArray(data10)){
if(data10.length < 1){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps",schemaPath:"#/properties/quests/items/properties/steps/minItems",keyword:"minItems",params:{limit: 1},message:"must NOT have fewer than 1 items"}];
return false;
}
else {
var valid3 = true;
const len1 = data10.length;
for(let i1=0; i1<len1; i1++){
let data11 = data10[i1];
const _errs24 = errors;
if(errors === _errs24){
if(data11 && typeof data11 == "object" && !Array.isArray(data11)){
let missing2;
if((((data11.id === undefined) && (missing2 = "id")) || ((data11.text === undefined) && (missing2 = "text"))) || ((data11.done_when === undefined) && (missing2 = "done_when"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1,schemaPath:"#/properties/quests/items/properties/steps/items/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
const _errs26 = errors;
for(const key2 in data11){
if(!((((key2 === "id") || (key2 === "text")) || (key2 === "hint")) || (key2 === "done_when"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1,schemaPath:"#/properties/quests/items/properties/steps/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs26 === errors){
if(data11.id !== undefined){
let data12 = data11.id;
const _errs27 = errors;
if(errors === _errs27){
if(typeof data12 === "string"){
if(!pattern5.test(data12)){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/id",schemaPath:"#/properties/quests/items/properties/steps/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9-]+$"},message:"must match pattern \""+"^[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/id",schemaPath:"#/properties/quests/items/properties/steps/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid4 = _errs27 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data11.text !== undefined){
let data13 = data11.text;
const _errs29 = errors;
if(errors === _errs29){
if(typeof data13 === "string"){
if(func2(data13) > 160){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/text",schemaPath:"#/properties/quests/items/properties/steps/items/properties/text/maxLength",keyword:"maxLength",params:{limit: 160},message:"must NOT have more than 160 characters"}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/text",schemaPath:"#/properties/quests/items/properties/steps/items/properties/text/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid4 = _errs29 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data11.hint !== undefined){
let data14 = data11.hint;
const _errs31 = errors;
if(errors === _errs31){
if(typeof data14 === "string"){
if(func2(data14) > 240){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/hint",schemaPath:"#/properties/quests/items/properties/steps/items/properties/hint/maxLength",keyword:"maxLength",params:{limit: 240},message:"must NOT have more than 240 characters"}];
return false;
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/hint",schemaPath:"#/properties/quests/items/properties/steps/items/properties/hint/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid4 = _errs31 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data11.done_when !== undefined){
let data15 = data11.done_when;
const _errs33 = errors;
if(!((((((((((((((((data15 === "settled") || (data15 === "office_ready")) || (data15 === "search_answered")) || (data15 === "search_answered_other_language")) || (data15 === "brief_answered")) || (data15 === "evidence_opened")) || (data15 === "report_made")) || (data15 === "lobby_entered")) || (data15 === "abstained_seen")) || (data15 === "source_added")) || (data15 === "numbers_seen")) || (data15 === "opportunity_saved")) || (data15 === "connection_saved")) || (data15 === "library_item_saved")) || (data15 === "message_sent")) || (data15 === "garage_visited"))){
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1+"/done_when",schemaPath:"#/properties/quests/items/properties/steps/items/properties/done_when/enum",keyword:"enum",params:{allowedValues: schema39.properties.quests.items.properties.steps.items.properties.done_when.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid4 = _errs33 === errors;
}
else {
var valid4 = true;
}
}
}
}
}
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps/" + i1,schemaPath:"#/properties/quests/items/properties/steps/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid3 = _errs24 === errors;
if(!valid3){
break;
}
}
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0+"/steps",schemaPath:"#/properties/quests/items/properties/steps/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid2 = _errs22 === errors;
}
else {
var valid2 = true;
}
}
}
}
}
}
}
}
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests/" + i0,schemaPath:"#/properties/quests/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid1 = _errs8 === errors;
if(!valid1){
break;
}
}
}
}
else {
validate42.errors = [{instancePath:instancePath+"/quests",schemaPath:"#/properties/quests/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
else {
validate42.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate42.errors = vErrors;
return errors === 0;
}
validate42.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isAgentReply = validate43;
const schema40 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"agent.schema.json","title":"AgentReply","description":"POST /api/agent. The Navigator agent answers only from its tool results: every person it names appears in `mentions`, and every mention is a profile in one of `results`. Actions are things the app does on screen; the agent never contacts anyone.","type":"object","required":["reply","mode","actions","results","mentions","versions"],"additionalProperties":false,"properties":{"reply":{"type":"string","maxLength":800},"mode":{"enum":["live","replay","mock"]},"abstained":{"type":"boolean"},"actions":{"type":"array","maxItems":6,"items":{"oneOf":[{"type":"object","required":["type","result"],"additionalProperties":false,"properties":{"type":{"const":"show_on_map"},"result":{"type":"integer","minimum":0}}},{"type":"object","required":["type","profile_id"],"additionalProperties":false,"properties":{"type":{"const":"open_profile"},"profile_id":{"type":"string"}}},{"type":"object","required":["type","result"],"additionalProperties":false,"properties":{"type":{"const":"start_match_report"},"result":{"type":"integer","minimum":0}}}]}},"results":{"type":"array","maxItems":4,"items":{"$ref":"result.schema.json"}},"mentions":{"type":"array","items":{"type":"object","required":["profile_id","name"],"additionalProperties":false,"properties":{"profile_id":{"type":"string"},"name":{"type":"string"}}}},"tool_calls":{"type":"array","items":{"type":"object","required":["tool"],"additionalProperties":false,"properties":{"tool":{"enum":["search","brief","profile"]},"query":{"type":"string"}}}},"versions":{"type":"object","required":["engine","snapshot","prompts"],"additionalProperties":false,"properties":{"engine":{"type":"string"},"snapshot":{"type":"string"},"prompts":{"type":"string"},"models":{"type":"object","additionalProperties":{"type":"string"}}}}}};

function validate43(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="agent.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate43.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((((((data.reply === undefined) && (missing0 = "reply")) || ((data.mode === undefined) && (missing0 = "mode"))) || ((data.actions === undefined) && (missing0 = "actions"))) || ((data.results === undefined) && (missing0 = "results"))) || ((data.mentions === undefined) && (missing0 = "mentions"))) || ((data.versions === undefined) && (missing0 = "versions"))){
validate43.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((((((((key0 === "reply") || (key0 === "mode")) || (key0 === "abstained")) || (key0 === "actions")) || (key0 === "results")) || (key0 === "mentions")) || (key0 === "tool_calls")) || (key0 === "versions"))){
validate43.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.reply !== undefined){
let data0 = data.reply;
const _errs2 = errors;
if(errors === _errs2){
if(typeof data0 === "string"){
if(func2(data0) > 800){
validate43.errors = [{instancePath:instancePath+"/reply",schemaPath:"#/properties/reply/maxLength",keyword:"maxLength",params:{limit: 800},message:"must NOT have more than 800 characters"}];
return false;
}
}
else {
validate43.errors = [{instancePath:instancePath+"/reply",schemaPath:"#/properties/reply/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.mode !== undefined){
let data1 = data.mode;
const _errs4 = errors;
if(!(((data1 === "live") || (data1 === "replay")) || (data1 === "mock"))){
validate43.errors = [{instancePath:instancePath+"/mode",schemaPath:"#/properties/mode/enum",keyword:"enum",params:{allowedValues: schema40.properties.mode.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.abstained !== undefined){
const _errs5 = errors;
if(typeof data.abstained !== "boolean"){
validate43.errors = [{instancePath:instancePath+"/abstained",schemaPath:"#/properties/abstained/type",keyword:"type",params:{type: "boolean"},message:"must be boolean"}];
return false;
}
var valid0 = _errs5 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.actions !== undefined){
let data3 = data.actions;
const _errs7 = errors;
if(errors === _errs7){
if(Array.isArray(data3)){
if(data3.length > 6){
validate43.errors = [{instancePath:instancePath+"/actions",schemaPath:"#/properties/actions/maxItems",keyword:"maxItems",params:{limit: 6},message:"must NOT have more than 6 items"}];
return false;
}
else {
var valid1 = true;
const len0 = data3.length;
for(let i0=0; i0<len0; i0++){
let data4 = data3[i0];
const _errs9 = errors;
const _errs10 = errors;
let valid2 = false;
let passing0 = null;
const _errs11 = errors;
if(errors === _errs11){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
let missing1;
if(((data4.type === undefined) && (missing1 = "type")) || ((data4.result === undefined) && (missing1 = "result"))){
const err0 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/0/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
else {
const _errs13 = errors;
for(const key1 in data4){
if(!((key1 === "type") || (key1 === "result"))){
const err1 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/0/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
break;
}
}
if(_errs13 === errors){
if(data4.type !== undefined){
const _errs14 = errors;
if("show_on_map" !== data4.type){
const err2 = {instancePath:instancePath+"/actions/" + i0+"/type",schemaPath:"#/properties/actions/items/oneOf/0/properties/type/const",keyword:"const",params:{allowedValue: "show_on_map"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err2];
}
else {
vErrors.push(err2);
}
errors++;
}
var valid3 = _errs14 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.result !== undefined){
let data6 = data4.result;
const _errs15 = errors;
if(!(((typeof data6 == "number") && (!(data6 % 1) && !isNaN(data6))) && (isFinite(data6)))){
const err3 = {instancePath:instancePath+"/actions/" + i0+"/result",schemaPath:"#/properties/actions/items/oneOf/0/properties/result/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err3];
}
else {
vErrors.push(err3);
}
errors++;
}
if(errors === _errs15){
if((typeof data6 == "number") && (isFinite(data6))){
if(data6 < 0 || isNaN(data6)){
const err4 = {instancePath:instancePath+"/actions/" + i0+"/result",schemaPath:"#/properties/actions/items/oneOf/0/properties/result/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err4];
}
else {
vErrors.push(err4);
}
errors++;
}
}
}
var valid3 = _errs15 === errors;
}
else {
var valid3 = true;
}
}
}
}
}
else {
const err5 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/0/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err5];
}
else {
vErrors.push(err5);
}
errors++;
}
}
var _valid0 = _errs11 === errors;
if(_valid0){
valid2 = true;
passing0 = 0;
var props0 = true;
}
const _errs17 = errors;
if(errors === _errs17){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
let missing2;
if(((data4.type === undefined) && (missing2 = "type")) || ((data4.profile_id === undefined) && (missing2 = "profile_id"))){
const err6 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/1/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"};
if(vErrors === null){
vErrors = [err6];
}
else {
vErrors.push(err6);
}
errors++;
}
else {
const _errs19 = errors;
for(const key2 in data4){
if(!((key2 === "type") || (key2 === "profile_id"))){
const err7 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/1/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err7];
}
else {
vErrors.push(err7);
}
errors++;
break;
}
}
if(_errs19 === errors){
if(data4.type !== undefined){
const _errs20 = errors;
if("open_profile" !== data4.type){
const err8 = {instancePath:instancePath+"/actions/" + i0+"/type",schemaPath:"#/properties/actions/items/oneOf/1/properties/type/const",keyword:"const",params:{allowedValue: "open_profile"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err8];
}
else {
vErrors.push(err8);
}
errors++;
}
var valid4 = _errs20 === errors;
}
else {
var valid4 = true;
}
if(valid4){
if(data4.profile_id !== undefined){
const _errs21 = errors;
if(typeof data4.profile_id !== "string"){
const err9 = {instancePath:instancePath+"/actions/" + i0+"/profile_id",schemaPath:"#/properties/actions/items/oneOf/1/properties/profile_id/type",keyword:"type",params:{type: "string"},message:"must be string"};
if(vErrors === null){
vErrors = [err9];
}
else {
vErrors.push(err9);
}
errors++;
}
var valid4 = _errs21 === errors;
}
else {
var valid4 = true;
}
}
}
}
}
else {
const err10 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err10];
}
else {
vErrors.push(err10);
}
errors++;
}
}
var _valid0 = _errs17 === errors;
if(_valid0 && valid2){
valid2 = false;
passing0 = [passing0, 1];
}
else {
if(_valid0){
valid2 = true;
passing0 = 1;
if(props0 !== true){
props0 = true;
}
}
const _errs23 = errors;
if(errors === _errs23){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
let missing3;
if(((data4.type === undefined) && (missing3 = "type")) || ((data4.result === undefined) && (missing3 = "result"))){
const err11 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/2/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"};
if(vErrors === null){
vErrors = [err11];
}
else {
vErrors.push(err11);
}
errors++;
}
else {
const _errs25 = errors;
for(const key3 in data4){
if(!((key3 === "type") || (key3 === "result"))){
const err12 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/2/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"};
if(vErrors === null){
vErrors = [err12];
}
else {
vErrors.push(err12);
}
errors++;
break;
}
}
if(_errs25 === errors){
if(data4.type !== undefined){
const _errs26 = errors;
if("start_match_report" !== data4.type){
const err13 = {instancePath:instancePath+"/actions/" + i0+"/type",schemaPath:"#/properties/actions/items/oneOf/2/properties/type/const",keyword:"const",params:{allowedValue: "start_match_report"},message:"must be equal to constant"};
if(vErrors === null){
vErrors = [err13];
}
else {
vErrors.push(err13);
}
errors++;
}
var valid5 = _errs26 === errors;
}
else {
var valid5 = true;
}
if(valid5){
if(data4.result !== undefined){
let data10 = data4.result;
const _errs27 = errors;
if(!(((typeof data10 == "number") && (!(data10 % 1) && !isNaN(data10))) && (isFinite(data10)))){
const err14 = {instancePath:instancePath+"/actions/" + i0+"/result",schemaPath:"#/properties/actions/items/oneOf/2/properties/result/type",keyword:"type",params:{type: "integer"},message:"must be integer"};
if(vErrors === null){
vErrors = [err14];
}
else {
vErrors.push(err14);
}
errors++;
}
if(errors === _errs27){
if((typeof data10 == "number") && (isFinite(data10))){
if(data10 < 0 || isNaN(data10)){
const err15 = {instancePath:instancePath+"/actions/" + i0+"/result",schemaPath:"#/properties/actions/items/oneOf/2/properties/result/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"};
if(vErrors === null){
vErrors = [err15];
}
else {
vErrors.push(err15);
}
errors++;
}
}
}
var valid5 = _errs27 === errors;
}
else {
var valid5 = true;
}
}
}
}
}
else {
const err16 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf/2/type",keyword:"type",params:{type: "object"},message:"must be object"};
if(vErrors === null){
vErrors = [err16];
}
else {
vErrors.push(err16);
}
errors++;
}
}
var _valid0 = _errs23 === errors;
if(_valid0 && valid2){
valid2 = false;
passing0 = [passing0, 2];
}
else {
if(_valid0){
valid2 = true;
passing0 = 2;
if(props0 !== true){
props0 = true;
}
}
}
}
if(!valid2){
const err17 = {instancePath:instancePath+"/actions/" + i0,schemaPath:"#/properties/actions/items/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};
if(vErrors === null){
vErrors = [err17];
}
else {
vErrors.push(err17);
}
errors++;
validate43.errors = vErrors;
return false;
}
else {
errors = _errs10;
if(vErrors !== null){
if(_errs10){
vErrors.length = _errs10;
}
else {
vErrors = null;
}
}
}
var valid1 = _errs9 === errors;
if(!valid1){
break;
}
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/actions",schemaPath:"#/properties/actions/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs7 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.results !== undefined){
let data11 = data.results;
const _errs29 = errors;
if(errors === _errs29){
if(Array.isArray(data11)){
if(data11.length > 4){
validate43.errors = [{instancePath:instancePath+"/results",schemaPath:"#/properties/results/maxItems",keyword:"maxItems",params:{limit: 4},message:"must NOT have more than 4 items"}];
return false;
}
else {
var valid6 = true;
const len1 = data11.length;
for(let i1=0; i1<len1; i1++){
const _errs31 = errors;
if(!(validate20(data11[i1], {instancePath:instancePath+"/results/" + i1,parentData:data11,parentDataProperty:i1,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate20.errors : vErrors.concat(validate20.errors);
errors = vErrors.length;
}
var valid6 = _errs31 === errors;
if(!valid6){
break;
}
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/results",schemaPath:"#/properties/results/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs29 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.mentions !== undefined){
let data13 = data.mentions;
const _errs32 = errors;
if(errors === _errs32){
if(Array.isArray(data13)){
var valid7 = true;
const len2 = data13.length;
for(let i2=0; i2<len2; i2++){
let data14 = data13[i2];
const _errs34 = errors;
if(errors === _errs34){
if(data14 && typeof data14 == "object" && !Array.isArray(data14)){
let missing4;
if(((data14.profile_id === undefined) && (missing4 = "profile_id")) || ((data14.name === undefined) && (missing4 = "name"))){
validate43.errors = [{instancePath:instancePath+"/mentions/" + i2,schemaPath:"#/properties/mentions/items/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
const _errs36 = errors;
for(const key4 in data14){
if(!((key4 === "profile_id") || (key4 === "name"))){
validate43.errors = [{instancePath:instancePath+"/mentions/" + i2,schemaPath:"#/properties/mentions/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs36 === errors){
if(data14.profile_id !== undefined){
const _errs37 = errors;
if(typeof data14.profile_id !== "string"){
validate43.errors = [{instancePath:instancePath+"/mentions/" + i2+"/profile_id",schemaPath:"#/properties/mentions/items/properties/profile_id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid8 = _errs37 === errors;
}
else {
var valid8 = true;
}
if(valid8){
if(data14.name !== undefined){
const _errs39 = errors;
if(typeof data14.name !== "string"){
validate43.errors = [{instancePath:instancePath+"/mentions/" + i2+"/name",schemaPath:"#/properties/mentions/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid8 = _errs39 === errors;
}
else {
var valid8 = true;
}
}
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/mentions/" + i2,schemaPath:"#/properties/mentions/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid7 = _errs34 === errors;
if(!valid7){
break;
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/mentions",schemaPath:"#/properties/mentions/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs32 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.tool_calls !== undefined){
let data17 = data.tool_calls;
const _errs41 = errors;
if(errors === _errs41){
if(Array.isArray(data17)){
var valid9 = true;
const len3 = data17.length;
for(let i3=0; i3<len3; i3++){
let data18 = data17[i3];
const _errs43 = errors;
if(errors === _errs43){
if(data18 && typeof data18 == "object" && !Array.isArray(data18)){
let missing5;
if((data18.tool === undefined) && (missing5 = "tool")){
validate43.errors = [{instancePath:instancePath+"/tool_calls/" + i3,schemaPath:"#/properties/tool_calls/items/required",keyword:"required",params:{missingProperty: missing5},message:"must have required property '"+missing5+"'"}];
return false;
}
else {
const _errs45 = errors;
for(const key5 in data18){
if(!((key5 === "tool") || (key5 === "query"))){
validate43.errors = [{instancePath:instancePath+"/tool_calls/" + i3,schemaPath:"#/properties/tool_calls/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs45 === errors){
if(data18.tool !== undefined){
let data19 = data18.tool;
const _errs46 = errors;
if(!(((data19 === "search") || (data19 === "brief")) || (data19 === "profile"))){
validate43.errors = [{instancePath:instancePath+"/tool_calls/" + i3+"/tool",schemaPath:"#/properties/tool_calls/items/properties/tool/enum",keyword:"enum",params:{allowedValues: schema40.properties.tool_calls.items.properties.tool.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid10 = _errs46 === errors;
}
else {
var valid10 = true;
}
if(valid10){
if(data18.query !== undefined){
const _errs47 = errors;
if(typeof data18.query !== "string"){
validate43.errors = [{instancePath:instancePath+"/tool_calls/" + i3+"/query",schemaPath:"#/properties/tool_calls/items/properties/query/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid10 = _errs47 === errors;
}
else {
var valid10 = true;
}
}
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/tool_calls/" + i3,schemaPath:"#/properties/tool_calls/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid9 = _errs43 === errors;
if(!valid9){
break;
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/tool_calls",schemaPath:"#/properties/tool_calls/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs41 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.versions !== undefined){
let data21 = data.versions;
const _errs49 = errors;
if(errors === _errs49){
if(data21 && typeof data21 == "object" && !Array.isArray(data21)){
let missing6;
if((((data21.engine === undefined) && (missing6 = "engine")) || ((data21.snapshot === undefined) && (missing6 = "snapshot"))) || ((data21.prompts === undefined) && (missing6 = "prompts"))){
validate43.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/required",keyword:"required",params:{missingProperty: missing6},message:"must have required property '"+missing6+"'"}];
return false;
}
else {
const _errs51 = errors;
for(const key6 in data21){
if(!((((key6 === "engine") || (key6 === "snapshot")) || (key6 === "prompts")) || (key6 === "models"))){
validate43.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key6},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs51 === errors){
if(data21.engine !== undefined){
const _errs52 = errors;
if(typeof data21.engine !== "string"){
validate43.errors = [{instancePath:instancePath+"/versions/engine",schemaPath:"#/properties/versions/properties/engine/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid11 = _errs52 === errors;
}
else {
var valid11 = true;
}
if(valid11){
if(data21.snapshot !== undefined){
const _errs54 = errors;
if(typeof data21.snapshot !== "string"){
validate43.errors = [{instancePath:instancePath+"/versions/snapshot",schemaPath:"#/properties/versions/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid11 = _errs54 === errors;
}
else {
var valid11 = true;
}
if(valid11){
if(data21.prompts !== undefined){
const _errs56 = errors;
if(typeof data21.prompts !== "string"){
validate43.errors = [{instancePath:instancePath+"/versions/prompts",schemaPath:"#/properties/versions/properties/prompts/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid11 = _errs56 === errors;
}
else {
var valid11 = true;
}
if(valid11){
if(data21.models !== undefined){
let data25 = data21.models;
const _errs58 = errors;
if(errors === _errs58){
if(data25 && typeof data25 == "object" && !Array.isArray(data25)){
for(const key7 in data25){
const _errs61 = errors;
if(typeof data25[key7] !== "string"){
validate43.errors = [{instancePath:instancePath+"/versions/models/" + key7.replace(/~/g, "~0").replace(/\//g, "~1"),schemaPath:"#/properties/versions/properties/models/additionalProperties/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid12 = _errs61 === errors;
if(!valid12){
break;
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/versions/models",schemaPath:"#/properties/versions/properties/models/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid11 = _errs58 === errors;
}
else {
var valid11 = true;
}
}
}
}
}
}
}
else {
validate43.errors = [{instancePath:instancePath+"/versions",schemaPath:"#/properties/versions/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs49 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
}
}
else {
validate43.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate43.errors = vErrors;
return errors === 0;
}
validate43.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isSourcesList = validate45;
const schema41 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"sources.schema.json","title":"SourcesList","description":"GET /api/sources. Every institution configured under sources/, with what the loaded snapshot holds from it. Counts are read from the stored pages and profiles, never estimated.","type":"object","required":["snapshot","sources"],"additionalProperties":false,"properties":{"snapshot":{"type":"string"},"sources":{"type":"array","items":{"type":"object","required":["id","name","hosts","kinds","pages","profiles","newest_fetched_at"],"additionalProperties":false,"properties":{"id":{"type":"string","pattern":"^[a-z0-9-]+$"},"name":{"type":"string","minLength":1},"hosts":{"type":"array","items":{"type":"string","pattern":"^[a-z0-9.-]+$"}},"kinds":{"description":"The profile kinds the snapshot holds for this source.","type":"array","uniqueItems":true,"items":{"$ref":"profile.schema.json#/properties/kind"}},"pages":{"type":"integer","minimum":0},"profiles":{"type":"integer","minimum":0},"newest_fetched_at":{"description":"When the most recently fetched page of this source was fetched; null only when it has no pages.","type":["string","null"],"format":"date-time"}},"if":{"properties":{"pages":{"const":0}}},"then":{"properties":{"newest_fetched_at":{"type":"null"}}},"else":{"properties":{"newest_fetched_at":{"type":"string"}}}}}}};
const schema42 = {"enum":["person","unit","project","infrastructure","call","service","space"]};
const pattern18 = new RegExp("^[a-z0-9.-]+$", "u");
const func0 = runtime_equal;

function validate45(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="sources.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate45.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((data.snapshot === undefined) && (missing0 = "snapshot")) || ((data.sources === undefined) && (missing0 = "sources"))){
validate45.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((key0 === "snapshot") || (key0 === "sources"))){
validate45.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.snapshot !== undefined){
const _errs2 = errors;
if(typeof data.snapshot !== "string"){
validate45.errors = [{instancePath:instancePath+"/snapshot",schemaPath:"#/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.sources !== undefined){
let data1 = data.sources;
const _errs4 = errors;
if(errors === _errs4){
if(Array.isArray(data1)){
var valid1 = true;
const len0 = data1.length;
for(let i0=0; i0<len0; i0++){
let data2 = data1[i0];
const _errs6 = errors;
const _errs8 = errors;
let valid2 = true;
const _errs9 = errors;
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
if(data2.pages !== undefined){
if(0 !== data2.pages){
const err0 = {};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
}
}
var _valid0 = _errs9 === errors;
errors = _errs8;
if(vErrors !== null){
if(_errs8){
vErrors.length = _errs8;
}
else {
vErrors = null;
}
}
let ifClause0;
if(_valid0){
const _errs11 = errors;
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
if(data2.newest_fetched_at !== undefined){
if(data2.newest_fetched_at !== null){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/newest_fetched_at",schemaPath:"#/properties/sources/items/then/properties/newest_fetched_at/type",keyword:"type",params:{type: "null"},message:"must be null"}];
return false;
}
}
}
var _valid0 = _errs11 === errors;
valid2 = _valid0;
if(valid2){
var props0 = {};
props0.newest_fetched_at = true;
props0.pages = true;
}
ifClause0 = "then";
}
else {
const _errs14 = errors;
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
if(data2.newest_fetched_at !== undefined){
if(typeof data2.newest_fetched_at !== "string"){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/newest_fetched_at",schemaPath:"#/properties/sources/items/else/properties/newest_fetched_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var _valid0 = _errs14 === errors;
valid2 = _valid0;
if(valid2){
if(props0 !== true){
props0 = props0 || {};
props0.newest_fetched_at = true;
}
}
ifClause0 = "else";
}
if(!valid2){
const err1 = {instancePath:instancePath+"/sources/" + i0,schemaPath:"#/properties/sources/items/if",keyword:"if",params:{failingKeyword: ifClause0},message:"must match \""+ifClause0+"\" schema"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
validate45.errors = vErrors;
return false;
}
if(errors === _errs6){
if(data2 && typeof data2 == "object" && !Array.isArray(data2)){
let missing1;
if((((((((data2.id === undefined) && (missing1 = "id")) || ((data2.name === undefined) && (missing1 = "name"))) || ((data2.hosts === undefined) && (missing1 = "hosts"))) || ((data2.kinds === undefined) && (missing1 = "kinds"))) || ((data2.pages === undefined) && (missing1 = "pages"))) || ((data2.profiles === undefined) && (missing1 = "profiles"))) || ((data2.newest_fetched_at === undefined) && (missing1 = "newest_fetched_at"))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0,schemaPath:"#/properties/sources/items/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs17 = errors;
for(const key1 in data2){
if(!(((((((key1 === "id") || (key1 === "name")) || (key1 === "hosts")) || (key1 === "kinds")) || (key1 === "pages")) || (key1 === "profiles")) || (key1 === "newest_fetched_at"))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0,schemaPath:"#/properties/sources/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs17 === errors){
if(data2.id !== undefined){
let data6 = data2.id;
const _errs18 = errors;
if(errors === _errs18){
if(typeof data6 === "string"){
if(!pattern5.test(data6)){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/id",schemaPath:"#/properties/sources/items/properties/id/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9-]+$"},message:"must match pattern \""+"^[a-z0-9-]+$"+"\""}];
return false;
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/id",schemaPath:"#/properties/sources/items/properties/id/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid6 = _errs18 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.name !== undefined){
let data7 = data2.name;
const _errs20 = errors;
if(errors === _errs20){
if(typeof data7 === "string"){
if(func2(data7) < 1){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/name",schemaPath:"#/properties/sources/items/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/name",schemaPath:"#/properties/sources/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid6 = _errs20 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.hosts !== undefined){
let data8 = data2.hosts;
const _errs22 = errors;
if(errors === _errs22){
if(Array.isArray(data8)){
var valid7 = true;
const len1 = data8.length;
for(let i1=0; i1<len1; i1++){
let data9 = data8[i1];
const _errs24 = errors;
if(errors === _errs24){
if(typeof data9 === "string"){
if(!pattern18.test(data9)){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/hosts/" + i1,schemaPath:"#/properties/sources/items/properties/hosts/items/pattern",keyword:"pattern",params:{pattern: "^[a-z0-9.-]+$"},message:"must match pattern \""+"^[a-z0-9.-]+$"+"\""}];
return false;
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/hosts/" + i1,schemaPath:"#/properties/sources/items/properties/hosts/items/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid7 = _errs24 === errors;
if(!valid7){
break;
}
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/hosts",schemaPath:"#/properties/sources/items/properties/hosts/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid6 = _errs22 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.kinds !== undefined){
let data10 = data2.kinds;
const _errs26 = errors;
if(errors === _errs26){
if(Array.isArray(data10)){
var valid8 = true;
const len2 = data10.length;
for(let i2=0; i2<len2; i2++){
let data11 = data10[i2];
const _errs28 = errors;
if(!(((((((data11 === "person") || (data11 === "unit")) || (data11 === "project")) || (data11 === "infrastructure")) || (data11 === "call")) || (data11 === "service")) || (data11 === "space"))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/kinds/" + i2,schemaPath:"profile.schema.json#/properties/kind/enum",keyword:"enum",params:{allowedValues: schema42.enum},message:"must be equal to one of the allowed values"}];
return false;
}
var valid8 = _errs28 === errors;
if(!valid8){
break;
}
}
if(valid8){
let i3 = data10.length;
let j0;
if(i3 > 1){
outer0:
for(;i3--;){
for(j0 = i3; j0--;){
if(func0(data10[i3], data10[j0])){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/kinds",schemaPath:"#/properties/sources/items/properties/kinds/uniqueItems",keyword:"uniqueItems",params:{i: i3, j: j0},message:"must NOT have duplicate items (items ## "+j0+" and "+i3+" are identical)"}];
return false;
break outer0;
}
}
}
}
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/kinds",schemaPath:"#/properties/sources/items/properties/kinds/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid6 = _errs26 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.pages !== undefined){
let data12 = data2.pages;
const _errs30 = errors;
if(!(((typeof data12 == "number") && (!(data12 % 1) && !isNaN(data12))) && (isFinite(data12)))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/pages",schemaPath:"#/properties/sources/items/properties/pages/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs30){
if((typeof data12 == "number") && (isFinite(data12))){
if(data12 < 0 || isNaN(data12)){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/pages",schemaPath:"#/properties/sources/items/properties/pages/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid6 = _errs30 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.profiles !== undefined){
let data13 = data2.profiles;
const _errs32 = errors;
if(!(((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13))) && (isFinite(data13)))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/profiles",schemaPath:"#/properties/sources/items/properties/profiles/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs32){
if((typeof data13 == "number") && (isFinite(data13))){
if(data13 < 0 || isNaN(data13)){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/profiles",schemaPath:"#/properties/sources/items/properties/profiles/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid6 = _errs32 === errors;
}
else {
var valid6 = true;
}
if(valid6){
if(data2.newest_fetched_at !== undefined){
let data14 = data2.newest_fetched_at;
const _errs34 = errors;
if((typeof data14 !== "string") && (data14 !== null)){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/newest_fetched_at",schemaPath:"#/properties/sources/items/properties/newest_fetched_at/type",keyword:"type",params:{type: schema41.properties.sources.items.properties.newest_fetched_at.type},message:"must be string,null"}];
return false;
}
if(errors === _errs34){
if(errors === _errs34){
if(typeof data14 === "string"){
if(!(formats2.validate(data14))){
validate45.errors = [{instancePath:instancePath+"/sources/" + i0+"/newest_fetched_at",schemaPath:"#/properties/sources/items/properties/newest_fetched_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
}
}
var valid6 = _errs34 === errors;
}
else {
var valid6 = true;
}
}
}
}
}
}
}
}
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources/" + i0,schemaPath:"#/properties/sources/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid1 = _errs6 === errors;
if(!valid1){
break;
}
}
}
else {
validate45.errors = [{instancePath:instancePath+"/sources",schemaPath:"#/properties/sources/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
else {
validate45.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate45.errors = vErrors;
return errors === 0;
}
validate45.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isNumbers = validate46;
const schema43 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"numbers.schema.json","title":"Numbers","description":"GET /api/numbers. The measured numbers for the loaded snapshot: its evaluation as committed in eval/results/<snapshot>/metrics.json, and the model calls recorded in its cache pack.","type":"object","required":["snapshot","generated_at","eval","models"],"additionalProperties":false,"properties":{"snapshot":{"type":"string"},"generated_at":{"description":"When the engine answered.","type":"string","format":"date-time"},"eval":{"description":"The evaluation of this snapshot; null when none is committed.","anyOf":[{"$ref":"#/$defs/eval"},{"type":"null"}]},"models":{"description":"One entry per role and model, computed from the cache pack entries (role, model, latency_ms); a role with no entries is not listed. The pack holds no failure records, so ok equals calls; failures show only in the health response's failures_last_hour.","type":"array","items":{"type":"object","required":["role","model","calls","ok","median_ms","p95_ms"],"additionalProperties":false,"properties":{"role":{"type":"string"},"model":{"type":"string"},"calls":{"type":"integer","minimum":1},"ok":{"type":"integer","minimum":0},"median_ms":{"type":"integer","minimum":0},"p95_ms":{"type":"integer","minimum":0}}}}},"$defs":{"eval":{"title":"EvalNumbers","description":"The evaluator's measurements on the gold set (eval/gold.jsonl): invented_abstained counts the questions about invented entities the search abstained on, false_abstention the answerable questions it abstained on, traceable the shown claims whose span is in their stored page's text.","type":"object","required":["queries","recall_at_10","mrr","invented_abstained","false_abstention","traceable","invented_entities","slices"],"additionalProperties":false,"properties":{"queries":{"type":"integer","minimum":0},"recall_at_10":{"description":"The share with its confidence interval.","type":"object","required":["value","low","high"],"additionalProperties":false,"properties":{"value":{"$ref":"#/$defs/share"},"low":{"$ref":"#/$defs/share"},"high":{"$ref":"#/$defs/share"}}},"mrr":{"$ref":"#/$defs/share"},"invented_abstained":{"$ref":"#/$defs/tally"},"false_abstention":{"$ref":"#/$defs/tally"},"traceable":{"$ref":"#/$defs/tally"},"invented_entities":{"description":"Profiles shown, directly or through a related profile, that the snapshot does not hold.","type":"integer","minimum":0},"slices":{"description":"Recall@10 per slice of the gold set. A slice with nothing to measure (no answerable question, as for invented entities) is left out, never reported as 0.","type":"array","items":{"type":"object","required":["name","recall_at_10"],"additionalProperties":false,"properties":{"name":{"type":"string","minLength":1},"recall_at_10":{"$ref":"#/$defs/share"}}}}}},"share":{"type":"number","minimum":0,"maximum":1},"tally":{"description":"n counted out of `of` (the evaluator's proportion writes these as k and n).","type":"object","required":["n","of"],"additionalProperties":false,"properties":{"n":{"type":"integer","minimum":0},"of":{"type":"integer","minimum":0}}}}};
const schema44 = {"title":"EvalNumbers","description":"The evaluator's measurements on the gold set (eval/gold.jsonl): invented_abstained counts the questions about invented entities the search abstained on, false_abstention the answerable questions it abstained on, traceable the shown claims whose span is in their stored page's text.","type":"object","required":["queries","recall_at_10","mrr","invented_abstained","false_abstention","traceable","invented_entities","slices"],"additionalProperties":false,"properties":{"queries":{"type":"integer","minimum":0},"recall_at_10":{"description":"The share with its confidence interval.","type":"object","required":["value","low","high"],"additionalProperties":false,"properties":{"value":{"$ref":"#/$defs/share"},"low":{"$ref":"#/$defs/share"},"high":{"$ref":"#/$defs/share"}}},"mrr":{"$ref":"#/$defs/share"},"invented_abstained":{"$ref":"#/$defs/tally"},"false_abstention":{"$ref":"#/$defs/tally"},"traceable":{"$ref":"#/$defs/tally"},"invented_entities":{"description":"Profiles shown, directly or through a related profile, that the snapshot does not hold.","type":"integer","minimum":0},"slices":{"description":"Recall@10 per slice of the gold set. A slice with nothing to measure (no answerable question, as for invented entities) is left out, never reported as 0.","type":"array","items":{"type":"object","required":["name","recall_at_10"],"additionalProperties":false,"properties":{"name":{"type":"string","minLength":1},"recall_at_10":{"$ref":"#/$defs/share"}}}}}};
const schema45 = {"type":"number","minimum":0,"maximum":1};
const schema49 = {"description":"n counted out of `of` (the evaluator's proportion writes these as k and n).","type":"object","required":["n","of"],"additionalProperties":false,"properties":{"n":{"type":"integer","minimum":0},"of":{"type":"integer","minimum":0}}};

function validate47(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
let vErrors = null;
let errors = 0;
const evaluated0 = validate47.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((((((((data.queries === undefined) && (missing0 = "queries")) || ((data.recall_at_10 === undefined) && (missing0 = "recall_at_10"))) || ((data.mrr === undefined) && (missing0 = "mrr"))) || ((data.invented_abstained === undefined) && (missing0 = "invented_abstained"))) || ((data.false_abstention === undefined) && (missing0 = "false_abstention"))) || ((data.traceable === undefined) && (missing0 = "traceable"))) || ((data.invented_entities === undefined) && (missing0 = "invented_entities"))) || ((data.slices === undefined) && (missing0 = "slices"))){
validate47.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((((((((key0 === "queries") || (key0 === "recall_at_10")) || (key0 === "mrr")) || (key0 === "invented_abstained")) || (key0 === "false_abstention")) || (key0 === "traceable")) || (key0 === "invented_entities")) || (key0 === "slices"))){
validate47.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.queries !== undefined){
let data0 = data.queries;
const _errs2 = errors;
if(!(((typeof data0 == "number") && (!(data0 % 1) && !isNaN(data0))) && (isFinite(data0)))){
validate47.errors = [{instancePath:instancePath+"/queries",schemaPath:"#/properties/queries/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs2){
if((typeof data0 == "number") && (isFinite(data0))){
if(data0 < 0 || isNaN(data0)){
validate47.errors = [{instancePath:instancePath+"/queries",schemaPath:"#/properties/queries/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.recall_at_10 !== undefined){
let data1 = data.recall_at_10;
const _errs4 = errors;
if(errors === _errs4){
if(data1 && typeof data1 == "object" && !Array.isArray(data1)){
let missing1;
if((((data1.value === undefined) && (missing1 = "value")) || ((data1.low === undefined) && (missing1 = "low"))) || ((data1.high === undefined) && (missing1 = "high"))){
validate47.errors = [{instancePath:instancePath+"/recall_at_10",schemaPath:"#/properties/recall_at_10/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs6 = errors;
for(const key1 in data1){
if(!(((key1 === "value") || (key1 === "low")) || (key1 === "high"))){
validate47.errors = [{instancePath:instancePath+"/recall_at_10",schemaPath:"#/properties/recall_at_10/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs6 === errors){
if(data1.value !== undefined){
let data2 = data1.value;
const _errs7 = errors;
const _errs8 = errors;
if(errors === _errs8){
if((typeof data2 == "number") && (isFinite(data2))){
if(data2 > 1 || isNaN(data2)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/value",schemaPath:"#/$defs/share/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data2 < 0 || isNaN(data2)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/value",schemaPath:"#/$defs/share/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/recall_at_10/value",schemaPath:"#/$defs/share/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid1 = _errs7 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data1.low !== undefined){
let data3 = data1.low;
const _errs10 = errors;
const _errs11 = errors;
if(errors === _errs11){
if((typeof data3 == "number") && (isFinite(data3))){
if(data3 > 1 || isNaN(data3)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/low",schemaPath:"#/$defs/share/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data3 < 0 || isNaN(data3)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/low",schemaPath:"#/$defs/share/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/recall_at_10/low",schemaPath:"#/$defs/share/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid1 = _errs10 === errors;
}
else {
var valid1 = true;
}
if(valid1){
if(data1.high !== undefined){
let data4 = data1.high;
const _errs13 = errors;
const _errs14 = errors;
if(errors === _errs14){
if((typeof data4 == "number") && (isFinite(data4))){
if(data4 > 1 || isNaN(data4)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/high",schemaPath:"#/$defs/share/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data4 < 0 || isNaN(data4)){
validate47.errors = [{instancePath:instancePath+"/recall_at_10/high",schemaPath:"#/$defs/share/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/recall_at_10/high",schemaPath:"#/$defs/share/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid1 = _errs13 === errors;
}
else {
var valid1 = true;
}
}
}
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/recall_at_10",schemaPath:"#/properties/recall_at_10/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.mrr !== undefined){
let data5 = data.mrr;
const _errs16 = errors;
const _errs17 = errors;
if(errors === _errs17){
if((typeof data5 == "number") && (isFinite(data5))){
if(data5 > 1 || isNaN(data5)){
validate47.errors = [{instancePath:instancePath+"/mrr",schemaPath:"#/$defs/share/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data5 < 0 || isNaN(data5)){
validate47.errors = [{instancePath:instancePath+"/mrr",schemaPath:"#/$defs/share/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/mrr",schemaPath:"#/$defs/share/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid0 = _errs16 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.invented_abstained !== undefined){
let data6 = data.invented_abstained;
const _errs19 = errors;
const _errs20 = errors;
if(errors === _errs20){
if(data6 && typeof data6 == "object" && !Array.isArray(data6)){
let missing2;
if(((data6.n === undefined) && (missing2 = "n")) || ((data6.of === undefined) && (missing2 = "of"))){
validate47.errors = [{instancePath:instancePath+"/invented_abstained",schemaPath:"#/$defs/tally/required",keyword:"required",params:{missingProperty: missing2},message:"must have required property '"+missing2+"'"}];
return false;
}
else {
const _errs22 = errors;
for(const key2 in data6){
if(!((key2 === "n") || (key2 === "of"))){
validate47.errors = [{instancePath:instancePath+"/invented_abstained",schemaPath:"#/$defs/tally/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key2},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs22 === errors){
if(data6.n !== undefined){
let data7 = data6.n;
const _errs23 = errors;
if(!(((typeof data7 == "number") && (!(data7 % 1) && !isNaN(data7))) && (isFinite(data7)))){
validate47.errors = [{instancePath:instancePath+"/invented_abstained/n",schemaPath:"#/$defs/tally/properties/n/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs23){
if((typeof data7 == "number") && (isFinite(data7))){
if(data7 < 0 || isNaN(data7)){
validate47.errors = [{instancePath:instancePath+"/invented_abstained/n",schemaPath:"#/$defs/tally/properties/n/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid7 = _errs23 === errors;
}
else {
var valid7 = true;
}
if(valid7){
if(data6.of !== undefined){
let data8 = data6.of;
const _errs25 = errors;
if(!(((typeof data8 == "number") && (!(data8 % 1) && !isNaN(data8))) && (isFinite(data8)))){
validate47.errors = [{instancePath:instancePath+"/invented_abstained/of",schemaPath:"#/$defs/tally/properties/of/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs25){
if((typeof data8 == "number") && (isFinite(data8))){
if(data8 < 0 || isNaN(data8)){
validate47.errors = [{instancePath:instancePath+"/invented_abstained/of",schemaPath:"#/$defs/tally/properties/of/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid7 = _errs25 === errors;
}
else {
var valid7 = true;
}
}
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/invented_abstained",schemaPath:"#/$defs/tally/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs19 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.false_abstention !== undefined){
let data9 = data.false_abstention;
const _errs27 = errors;
const _errs28 = errors;
if(errors === _errs28){
if(data9 && typeof data9 == "object" && !Array.isArray(data9)){
let missing3;
if(((data9.n === undefined) && (missing3 = "n")) || ((data9.of === undefined) && (missing3 = "of"))){
validate47.errors = [{instancePath:instancePath+"/false_abstention",schemaPath:"#/$defs/tally/required",keyword:"required",params:{missingProperty: missing3},message:"must have required property '"+missing3+"'"}];
return false;
}
else {
const _errs30 = errors;
for(const key3 in data9){
if(!((key3 === "n") || (key3 === "of"))){
validate47.errors = [{instancePath:instancePath+"/false_abstention",schemaPath:"#/$defs/tally/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key3},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs30 === errors){
if(data9.n !== undefined){
let data10 = data9.n;
const _errs31 = errors;
if(!(((typeof data10 == "number") && (!(data10 % 1) && !isNaN(data10))) && (isFinite(data10)))){
validate47.errors = [{instancePath:instancePath+"/false_abstention/n",schemaPath:"#/$defs/tally/properties/n/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs31){
if((typeof data10 == "number") && (isFinite(data10))){
if(data10 < 0 || isNaN(data10)){
validate47.errors = [{instancePath:instancePath+"/false_abstention/n",schemaPath:"#/$defs/tally/properties/n/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid9 = _errs31 === errors;
}
else {
var valid9 = true;
}
if(valid9){
if(data9.of !== undefined){
let data11 = data9.of;
const _errs33 = errors;
if(!(((typeof data11 == "number") && (!(data11 % 1) && !isNaN(data11))) && (isFinite(data11)))){
validate47.errors = [{instancePath:instancePath+"/false_abstention/of",schemaPath:"#/$defs/tally/properties/of/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs33){
if((typeof data11 == "number") && (isFinite(data11))){
if(data11 < 0 || isNaN(data11)){
validate47.errors = [{instancePath:instancePath+"/false_abstention/of",schemaPath:"#/$defs/tally/properties/of/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid9 = _errs33 === errors;
}
else {
var valid9 = true;
}
}
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/false_abstention",schemaPath:"#/$defs/tally/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs27 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.traceable !== undefined){
let data12 = data.traceable;
const _errs35 = errors;
const _errs36 = errors;
if(errors === _errs36){
if(data12 && typeof data12 == "object" && !Array.isArray(data12)){
let missing4;
if(((data12.n === undefined) && (missing4 = "n")) || ((data12.of === undefined) && (missing4 = "of"))){
validate47.errors = [{instancePath:instancePath+"/traceable",schemaPath:"#/$defs/tally/required",keyword:"required",params:{missingProperty: missing4},message:"must have required property '"+missing4+"'"}];
return false;
}
else {
const _errs38 = errors;
for(const key4 in data12){
if(!((key4 === "n") || (key4 === "of"))){
validate47.errors = [{instancePath:instancePath+"/traceable",schemaPath:"#/$defs/tally/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key4},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs38 === errors){
if(data12.n !== undefined){
let data13 = data12.n;
const _errs39 = errors;
if(!(((typeof data13 == "number") && (!(data13 % 1) && !isNaN(data13))) && (isFinite(data13)))){
validate47.errors = [{instancePath:instancePath+"/traceable/n",schemaPath:"#/$defs/tally/properties/n/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs39){
if((typeof data13 == "number") && (isFinite(data13))){
if(data13 < 0 || isNaN(data13)){
validate47.errors = [{instancePath:instancePath+"/traceable/n",schemaPath:"#/$defs/tally/properties/n/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid11 = _errs39 === errors;
}
else {
var valid11 = true;
}
if(valid11){
if(data12.of !== undefined){
let data14 = data12.of;
const _errs41 = errors;
if(!(((typeof data14 == "number") && (!(data14 % 1) && !isNaN(data14))) && (isFinite(data14)))){
validate47.errors = [{instancePath:instancePath+"/traceable/of",schemaPath:"#/$defs/tally/properties/of/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs41){
if((typeof data14 == "number") && (isFinite(data14))){
if(data14 < 0 || isNaN(data14)){
validate47.errors = [{instancePath:instancePath+"/traceable/of",schemaPath:"#/$defs/tally/properties/of/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid11 = _errs41 === errors;
}
else {
var valid11 = true;
}
}
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/traceable",schemaPath:"#/$defs/tally/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid0 = _errs35 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.invented_entities !== undefined){
let data15 = data.invented_entities;
const _errs43 = errors;
if(!(((typeof data15 == "number") && (!(data15 % 1) && !isNaN(data15))) && (isFinite(data15)))){
validate47.errors = [{instancePath:instancePath+"/invented_entities",schemaPath:"#/properties/invented_entities/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs43){
if((typeof data15 == "number") && (isFinite(data15))){
if(data15 < 0 || isNaN(data15)){
validate47.errors = [{instancePath:instancePath+"/invented_entities",schemaPath:"#/properties/invented_entities/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs43 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.slices !== undefined){
let data16 = data.slices;
const _errs45 = errors;
if(errors === _errs45){
if(Array.isArray(data16)){
var valid12 = true;
const len0 = data16.length;
for(let i0=0; i0<len0; i0++){
let data17 = data16[i0];
const _errs47 = errors;
if(errors === _errs47){
if(data17 && typeof data17 == "object" && !Array.isArray(data17)){
let missing5;
if(((data17.name === undefined) && (missing5 = "name")) || ((data17.recall_at_10 === undefined) && (missing5 = "recall_at_10"))){
validate47.errors = [{instancePath:instancePath+"/slices/" + i0,schemaPath:"#/properties/slices/items/required",keyword:"required",params:{missingProperty: missing5},message:"must have required property '"+missing5+"'"}];
return false;
}
else {
const _errs49 = errors;
for(const key5 in data17){
if(!((key5 === "name") || (key5 === "recall_at_10"))){
validate47.errors = [{instancePath:instancePath+"/slices/" + i0,schemaPath:"#/properties/slices/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key5},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs49 === errors){
if(data17.name !== undefined){
let data18 = data17.name;
const _errs50 = errors;
if(errors === _errs50){
if(typeof data18 === "string"){
if(func2(data18) < 1){
validate47.errors = [{instancePath:instancePath+"/slices/" + i0+"/name",schemaPath:"#/properties/slices/items/properties/name/minLength",keyword:"minLength",params:{limit: 1},message:"must NOT have fewer than 1 characters"}];
return false;
}
}
else {
validate47.errors = [{instancePath:instancePath+"/slices/" + i0+"/name",schemaPath:"#/properties/slices/items/properties/name/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
var valid13 = _errs50 === errors;
}
else {
var valid13 = true;
}
if(valid13){
if(data17.recall_at_10 !== undefined){
let data19 = data17.recall_at_10;
const _errs52 = errors;
const _errs53 = errors;
if(errors === _errs53){
if((typeof data19 == "number") && (isFinite(data19))){
if(data19 > 1 || isNaN(data19)){
validate47.errors = [{instancePath:instancePath+"/slices/" + i0+"/recall_at_10",schemaPath:"#/$defs/share/maximum",keyword:"maximum",params:{comparison: "<=", limit: 1},message:"must be <= 1"}];
return false;
}
else {
if(data19 < 0 || isNaN(data19)){
validate47.errors = [{instancePath:instancePath+"/slices/" + i0+"/recall_at_10",schemaPath:"#/$defs/share/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/slices/" + i0+"/recall_at_10",schemaPath:"#/$defs/share/type",keyword:"type",params:{type: "number"},message:"must be number"}];
return false;
}
}
var valid13 = _errs52 === errors;
}
else {
var valid13 = true;
}
}
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/slices/" + i0,schemaPath:"#/properties/slices/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid12 = _errs47 === errors;
if(!valid12){
break;
}
}
}
else {
validate47.errors = [{instancePath:instancePath+"/slices",schemaPath:"#/properties/slices/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs45 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
}
}
}
}
else {
validate47.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate47.errors = vErrors;
return errors === 0;
}
validate47.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};


function validate46(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="numbers.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate46.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if(((((data.snapshot === undefined) && (missing0 = "snapshot")) || ((data.generated_at === undefined) && (missing0 = "generated_at"))) || ((data.eval === undefined) && (missing0 = "eval"))) || ((data.models === undefined) && (missing0 = "models"))){
validate46.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!((((key0 === "snapshot") || (key0 === "generated_at")) || (key0 === "eval")) || (key0 === "models"))){
validate46.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.snapshot !== undefined){
const _errs2 = errors;
if(typeof data.snapshot !== "string"){
validate46.errors = [{instancePath:instancePath+"/snapshot",schemaPath:"#/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.generated_at !== undefined){
let data1 = data.generated_at;
const _errs4 = errors;
if(errors === _errs4){
if(errors === _errs4){
if(typeof data1 === "string"){
if(!(formats2.validate(data1))){
validate46.errors = [{instancePath:instancePath+"/generated_at",schemaPath:"#/properties/generated_at/format",keyword:"format",params:{format: "date-time"},message:"must match format \""+"date-time"+"\""}];
return false;
}
}
else {
validate46.errors = [{instancePath:instancePath+"/generated_at",schemaPath:"#/properties/generated_at/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.eval !== undefined){
let data2 = data.eval;
const _errs6 = errors;
const _errs7 = errors;
let valid1 = false;
const _errs8 = errors;
if(!(validate47(data2, {instancePath:instancePath+"/eval",parentData:data,parentDataProperty:"eval",rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
errors = vErrors.length;
}
var _valid0 = _errs8 === errors;
valid1 = valid1 || _valid0;
const _errs9 = errors;
if(data2 !== null){
const err0 = {instancePath:instancePath+"/eval",schemaPath:"#/properties/eval/anyOf/1/type",keyword:"type",params:{type: "null"},message:"must be null"};
if(vErrors === null){
vErrors = [err0];
}
else {
vErrors.push(err0);
}
errors++;
}
var _valid0 = _errs9 === errors;
valid1 = valid1 || _valid0;
if(!valid1){
const err1 = {instancePath:instancePath+"/eval",schemaPath:"#/properties/eval/anyOf",keyword:"anyOf",params:{},message:"must match a schema in anyOf"};
if(vErrors === null){
vErrors = [err1];
}
else {
vErrors.push(err1);
}
errors++;
validate46.errors = vErrors;
return false;
}
else {
errors = _errs7;
if(vErrors !== null){
if(_errs7){
vErrors.length = _errs7;
}
else {
vErrors = null;
}
}
}
var valid0 = _errs6 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.models !== undefined){
let data3 = data.models;
const _errs11 = errors;
if(errors === _errs11){
if(Array.isArray(data3)){
var valid2 = true;
const len0 = data3.length;
for(let i0=0; i0<len0; i0++){
let data4 = data3[i0];
const _errs13 = errors;
if(errors === _errs13){
if(data4 && typeof data4 == "object" && !Array.isArray(data4)){
let missing1;
if(((((((data4.role === undefined) && (missing1 = "role")) || ((data4.model === undefined) && (missing1 = "model"))) || ((data4.calls === undefined) && (missing1 = "calls"))) || ((data4.ok === undefined) && (missing1 = "ok"))) || ((data4.median_ms === undefined) && (missing1 = "median_ms"))) || ((data4.p95_ms === undefined) && (missing1 = "p95_ms"))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0,schemaPath:"#/properties/models/items/required",keyword:"required",params:{missingProperty: missing1},message:"must have required property '"+missing1+"'"}];
return false;
}
else {
const _errs15 = errors;
for(const key1 in data4){
if(!((((((key1 === "role") || (key1 === "model")) || (key1 === "calls")) || (key1 === "ok")) || (key1 === "median_ms")) || (key1 === "p95_ms"))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0,schemaPath:"#/properties/models/items/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key1},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs15 === errors){
if(data4.role !== undefined){
const _errs16 = errors;
if(typeof data4.role !== "string"){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/role",schemaPath:"#/properties/models/items/properties/role/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid3 = _errs16 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.model !== undefined){
const _errs18 = errors;
if(typeof data4.model !== "string"){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/model",schemaPath:"#/properties/models/items/properties/model/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid3 = _errs18 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.calls !== undefined){
let data7 = data4.calls;
const _errs20 = errors;
if(!(((typeof data7 == "number") && (!(data7 % 1) && !isNaN(data7))) && (isFinite(data7)))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/calls",schemaPath:"#/properties/models/items/properties/calls/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs20){
if((typeof data7 == "number") && (isFinite(data7))){
if(data7 < 1 || isNaN(data7)){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/calls",schemaPath:"#/properties/models/items/properties/calls/minimum",keyword:"minimum",params:{comparison: ">=", limit: 1},message:"must be >= 1"}];
return false;
}
}
}
var valid3 = _errs20 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.ok !== undefined){
let data8 = data4.ok;
const _errs22 = errors;
if(!(((typeof data8 == "number") && (!(data8 % 1) && !isNaN(data8))) && (isFinite(data8)))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/ok",schemaPath:"#/properties/models/items/properties/ok/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs22){
if((typeof data8 == "number") && (isFinite(data8))){
if(data8 < 0 || isNaN(data8)){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/ok",schemaPath:"#/properties/models/items/properties/ok/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid3 = _errs22 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.median_ms !== undefined){
let data9 = data4.median_ms;
const _errs24 = errors;
if(!(((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9))) && (isFinite(data9)))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/median_ms",schemaPath:"#/properties/models/items/properties/median_ms/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs24){
if((typeof data9 == "number") && (isFinite(data9))){
if(data9 < 0 || isNaN(data9)){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/median_ms",schemaPath:"#/properties/models/items/properties/median_ms/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid3 = _errs24 === errors;
}
else {
var valid3 = true;
}
if(valid3){
if(data4.p95_ms !== undefined){
let data10 = data4.p95_ms;
const _errs26 = errors;
if(!(((typeof data10 == "number") && (!(data10 % 1) && !isNaN(data10))) && (isFinite(data10)))){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/p95_ms",schemaPath:"#/properties/models/items/properties/p95_ms/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs26){
if((typeof data10 == "number") && (isFinite(data10))){
if(data10 < 0 || isNaN(data10)){
validate46.errors = [{instancePath:instancePath+"/models/" + i0+"/p95_ms",schemaPath:"#/properties/models/items/properties/p95_ms/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid3 = _errs26 === errors;
}
else {
var valid3 = true;
}
}
}
}
}
}
}
}
}
else {
validate46.errors = [{instancePath:instancePath+"/models/" + i0,schemaPath:"#/properties/models/items/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
var valid2 = _errs13 === errors;
if(!valid2){
break;
}
}
}
else {
validate46.errors = [{instancePath:instancePath+"/models",schemaPath:"#/properties/models/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs11 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
}
else {
validate46.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate46.errors = vErrors;
return errors === 0;
}
validate46.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

export const isPlacePeople = validate49;
const schema53 = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"place-people.schema.json","title":"PlacePeople","description":"GET /api/places/{source}/{host}/people. The person profiles of one place on the map (one host of a source), read from the loaded snapshot without a search: at most 30, ordered by name, with how many the place holds in all. Each profile carries its claims with evidence, like a search result.","type":"object","required":["snapshot","people","total"],"additionalProperties":false,"properties":{"snapshot":{"type":"string"},"people":{"type":"array","maxItems":30,"items":{"$ref":"profile.schema.json"}},"total":{"type":"integer","minimum":0}}};

function validate49(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){
/*# sourceURL="place-people.schema.json" */;
let vErrors = null;
let errors = 0;
const evaluated0 = validate49.evaluated;
if(evaluated0.dynamicProps){
evaluated0.props = undefined;
}
if(evaluated0.dynamicItems){
evaluated0.items = undefined;
}
if(errors === 0){
if(data && typeof data == "object" && !Array.isArray(data)){
let missing0;
if((((data.snapshot === undefined) && (missing0 = "snapshot")) || ((data.people === undefined) && (missing0 = "people"))) || ((data.total === undefined) && (missing0 = "total"))){
validate49.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];
return false;
}
else {
const _errs1 = errors;
for(const key0 in data){
if(!(((key0 === "snapshot") || (key0 === "people")) || (key0 === "total"))){
validate49.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];
return false;
break;
}
}
if(_errs1 === errors){
if(data.snapshot !== undefined){
const _errs2 = errors;
if(typeof data.snapshot !== "string"){
validate49.errors = [{instancePath:instancePath+"/snapshot",schemaPath:"#/properties/snapshot/type",keyword:"type",params:{type: "string"},message:"must be string"}];
return false;
}
var valid0 = _errs2 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.people !== undefined){
let data1 = data.people;
const _errs4 = errors;
if(errors === _errs4){
if(Array.isArray(data1)){
if(data1.length > 30){
validate49.errors = [{instancePath:instancePath+"/people",schemaPath:"#/properties/people/maxItems",keyword:"maxItems",params:{limit: 30},message:"must NOT have more than 30 items"}];
return false;
}
else {
var valid1 = true;
const len0 = data1.length;
for(let i0=0; i0<len0; i0++){
const _errs6 = errors;
if(!(validate21(data1[i0], {instancePath:instancePath+"/people/" + i0,parentData:data1,parentDataProperty:i0,rootData,dynamicAnchors}))){
vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
errors = vErrors.length;
}
var valid1 = _errs6 === errors;
if(!valid1){
break;
}
}
}
}
else {
validate49.errors = [{instancePath:instancePath+"/people",schemaPath:"#/properties/people/type",keyword:"type",params:{type: "array"},message:"must be array"}];
return false;
}
}
var valid0 = _errs4 === errors;
}
else {
var valid0 = true;
}
if(valid0){
if(data.total !== undefined){
let data3 = data.total;
const _errs7 = errors;
if(!(((typeof data3 == "number") && (!(data3 % 1) && !isNaN(data3))) && (isFinite(data3)))){
validate49.errors = [{instancePath:instancePath+"/total",schemaPath:"#/properties/total/type",keyword:"type",params:{type: "integer"},message:"must be integer"}];
return false;
}
if(errors === _errs7){
if((typeof data3 == "number") && (isFinite(data3))){
if(data3 < 0 || isNaN(data3)){
validate49.errors = [{instancePath:instancePath+"/total",schemaPath:"#/properties/total/minimum",keyword:"minimum",params:{comparison: ">=", limit: 0},message:"must be >= 0"}];
return false;
}
}
}
var valid0 = _errs7 === errors;
}
else {
var valid0 = true;
}
}
}
}
}
}
else {
validate49.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];
return false;
}
}
validate49.errors = vErrors;
return errors === 0;
}
validate49.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};

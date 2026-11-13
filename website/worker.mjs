// Support submits directly to Web3Forms with a public form key; no recipient is shipped.
export default {fetch(request,env){return env.ASSETS.fetch(request);}};

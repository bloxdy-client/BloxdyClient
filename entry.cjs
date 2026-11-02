'use strict';
if(!require('electron').app.isPackaged&&process.argv.some(arg=>['--bridge-client','--bridge-test','--offline'].includes(arg)))require('./bridge/desktop.cjs');
else require('./launcher/main.cjs');

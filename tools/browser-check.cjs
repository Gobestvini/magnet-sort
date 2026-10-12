// Active v4 flow; v3 scenario is archived beside this file.
require('./v4-browser-check.cjs').smoke(process.env.GAME_BASE_URL || 'http://127.0.0.1:5175/').catch(e=>{console.error(e);process.exitCode=1;});

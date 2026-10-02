/** Verify shipped ZIP contents and execute their actual background entry points. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const { load, request, SECRET } = require('./integration/background-monitor.test.js');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
function files(dir, prefix = '') {
    return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
        const name = prefix + entry.name;
        return entry.isDirectory() ? files(path.join(dir,entry.name), name + '/') : [name];
    }).sort();
}
(async () => {
    for (const browser of ['firefox','chrome','edge']) {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(),'ferretwatch-package-'));
        try {
            const build = path.join(root,'builds',browser);
            execFileSync('unzip',['-q',path.join(root,'dist',`ferretwatch-${browser}-v${manifest.version}.zip`),'-d',temp]);
            const names = files(temp);
            assert.deepEqual(names, files(build), 'ZIP and generated tree contain identical files');
            for (const name of names) {
                const data = fs.readFileSync(path.join(temp,name));
                assert.ok(data.equals(fs.readFileSync(path.join(build,name))), 'ZIP matches build: ' + name);
                if (name.endsWith('.js')) new vm.Script(data.toString(), {filename:name});
                if (name !== 'manifest.json' && fs.existsSync(path.join(root,name))) {
                    const source = fs.readFileSync(path.join(root,name));
                    if (!source.equals(data)) {
                        // The optional minifier changes background/content/popup scripts only.
                        assert.ok(name === 'background.js' || name.startsWith('content/') || name === 'popup/popup.js', 'stale source: ' + name);
                        const args = name === 'popup/popup.js' ? ['--compress','drop_console=false','--mangle'] :
                            ['--compress','drop_console=false,drop_debugger=true,unused=false','--mangle',"reserved=['browser','chrome']"];
                        const minified = execFileSync('terser',[path.join(root,name),...args]).toString().trimEnd();
                        assert.equal(data.toString().trimEnd(),minified,'minified source: ' + name);
                    }
                }
            }
            const packed = JSON.parse(fs.readFileSync(path.join(temp,'manifest.json')));
            assert.equal(packed.version,manifest.version);
            assert.ok(packed.permissions.includes('notifications'));
            assert.ok(packed.content_scripts[0].js.includes('content/dom-monitor.js'));
            for (const file of packed.content_scripts.flatMap(s => s.js)) assert.ok(names.includes(file),file);
            const worker = browser !== 'firefox';
            if (worker) {
                assert.equal(packed.manifest_version,3);
                assert.ok(!packed.permissions.includes('webRequestBlocking'));
            } else assert.deepEqual(packed, manifest);
            const h = await load(temp,{},worker);
            request(h,'packaged').finish(SECRET);
            await h.flush();
            assert.equal(h.bg.requestLog.forTab(1).length,1);
            if (!worker) {
                assert.equal(h.bg.findingStore.list(1,false)[0].value,SECRET);
                assert.equal(h.notices.length,1);
            } else {
                assert.equal(h.bg.findingStore.state(1),'unavailable');
                assert.equal(h.filters.size,0);
            }
            console.log(`${browser}: archive, source freshness, syntax and packaged background smoke checks passed`);
        } finally { fs.rmSync(temp,{recursive:true,force:true}); }
    }
})().catch(error=>{console.error(error);process.exitCode=1;});

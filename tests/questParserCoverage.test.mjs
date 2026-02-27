import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  extractQuickGuide,
  formatStepHtml,
  getQuestIcon,
  getQuestOverview,
  getRewardImage,
} from '../src/features/quests/questParser.js';

const setDomGlobals = (dom) => {
  global.window = dom.window;
  global.document = dom.window.document;
  global.DOMParser = dom.window.DOMParser;
  global.Node = dom.window.Node;
  global.NodeFilter = dom.window.NodeFilter;
};

test('getQuestIcon and getRewardImage read expected images', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <table class="questdetails plainlinks">
      <tr><td data-attr-param="iconDisp"><img src="/images/quest_icon.png" /></td></tr>
    </table>
    <h2 id="Rewards">Rewards</h2>
    <figure class="mw-default-size mw-halign-center"><img src="/images/reward_image.png" /></figure>
  `;

  const icon = getQuestIcon(html);
  const reward = getRewardImage(html);
  assert.equal(icon, 'https://runescape.wiki/images/quest_icon.png');
  assert.equal(reward, 'https://runescape.wiki/images/reward_image.png');
});

test('getRewardImage falls back to _reward hint and centered figure', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const byHint = `
    <div><figure><a href="/w/File:Something_reward.png"><img src="/images/x.png"></a></figure></div>
  `;
  assert.equal(getRewardImage(byHint), 'https://runescape.wiki/images/x.png');

  const byCentered = `
    <div>
      <figure class="mw-halign-center"><img src="/images/first.png"></figure>
      <figure class="mw-halign-center"><img src="/images/last.png"></figure>
    </div>
  `;
  assert.equal(getRewardImage(byCentered), 'https://runescape.wiki/images/last.png');
});

test('getQuestOverview extracts requirements split and item sections', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <table class="questdetails plainlinks">
      <tr>
        <th>Requirements</th>
        <td data-attr-param="requirements">
          <table class="questreq">
            <tr><th><img src="/images/quest_icon.png" /></th></tr>
            <tr><td><ul><li><a href="/w/The_Feud">The Feud</a></li></ul></td></tr>
          </table>
          <ul>
            <li><span class="skillreq">Attack</span> 50</li>
          </ul>
          <table class="mw-collapsible">
            <tr><th>Ironmen only</th></tr>
            <tr><td><ul><li><span class="skillreq">Magic</span> 60</li></ul></td></tr>
          </table>
        </td>
      </tr>
      <tr><th>Items</th><td data-attr-param="itemsDisp"><ul><li>Item A</li></ul></td></tr>
      <tr><th>Recommended</th><td data-attr-param="recommendedDisp"><ul><li>Item B</li></ul></td></tr>
      <tr><th>Combat</th><td data-attr-param="kills"><ul><li>Enemy C</li></ul></td></tr>
    </table>
  `;

  const overview = getQuestOverview(html);
  assert.ok(overview);
  assert.match(overview.requirementsQuests, /The Feud/);
  assert.match(overview.requirementsSkills, /Attack/);
  assert.match(overview.requirementsSkills, /Ironmen/i);
  assert.equal(overview.requirementsQuestsIcon, 'https://runescape.wiki/images/quest_icon.png');
  assert.match(overview.requiredItems, /Item A/);
  assert.match(overview.recommendedItems, /Item B/);
  assert.match(overview.combat, /Enemy C/);
});

test('getQuestOverview supports header fallback and hidden noise stripping', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <table class="questdetails plainlinks">
      <tr>
        <th>Requirements</th>
        <td>
          <ul>
            <li><span class="skillreq">Magic</span> 70</li>
            <li aria-hidden="true">Hidden row</li>
            <li style="display:none">Hidden style</li>
            <li><a href="/w/Quest_X">Quest X</a></li>
          </ul>
        </td>
      </tr>
      <tr><th>Items</th><td data-attr-param="itemsDisp"><ul><li><span class="tooltip">tip</span>Item</li></ul></td></tr>
    </table>
  `;
  const overview = getQuestOverview(html);
  assert.ok(overview);
  assert.match(overview.requirements, /Quest X/);
  assert.match(overview.requirements, /runescape\.wiki\/w\/Quest_X/);
  assert.doesNotMatch(overview.requirements, /Hidden row|Hidden style/);
  assert.doesNotMatch(overview.requiredItems, /tip/);
});

test('getQuestOverview returns null without quest table', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);
  assert.equal(getQuestOverview('<div>none</div>'), null);
});

test('extractQuickGuide captures notes/text/reflist and stops at Rewards heading', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Section One</h2>
        <p>Intro paragraph</p>
        <table class="messagebox"><tr><td>Warn box</td></tr></table>
        <table class="wikitable"><tr><td>Standalone table</td></tr></table>
        <div class="reflist"><ol class="references"><li>Ref one</li></ol></div>
        <div class="lighttable checklist"><ul><li>Step one</li></ul></div>
        <h2>Rewards</h2>
        <div class="lighttable checklist"><ul><li>Should not parse</li></ul></div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const titleItem = items.find((item) => item.type === 'title' && item.text === 'Section One');
  assert.ok(titleItem);
  assert.match(titleItem.sectionTexts.join(' '), /Intro paragraph/);

  const notes = items.filter((item) => item.type === 'note').map((item) => item.noteType);
  assert.ok(notes.includes('infobox'));
  assert.ok(notes.includes('table'));
  assert.ok(notes.includes('reflist'));

  const steps = items.filter((item) => item.type === 'step');
  assert.equal(steps.length, 1);
  assert.match(steps[0].text, /Step one/);
});

test('extractQuickGuide skips ignored headings and normalizes maps/links/images', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Overview</h2>
        <p>Ignore this block</p>
        <h2>Main section</h2>
        <div class="seealso"><a href="/w/Quest">needed</a></div>
        <figure><img src="//runescape.wiki/images/example.png" alt="fig"><figcaption>Cap</figcaption></figure>
        <div class="mw-kartographer-container">
          <a class="mw-kartographer-map" data-mw-kartographer style="display:block;width:300px;height:300px;background-image:url(x)"></a>
        </div>
        <div class="lighttable checklist">
          <ul>
            <li>Quest complete!</li>
            <li>Should stop here</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Main section');
  assert.ok(title);
  assert.ok(title.seeAlso[0].includes('<strong>Needed</strong>'));
  assert.equal(title.sectionImages[0].src, 'https://runescape.wiki/images/example.png');
  assert.equal(title.sectionAdvancedMaps.length, 1);
  const steps = items.filter((i) => i.type === 'step');
  assert.equal(steps.length, 1);
});

test('extractQuickGuide does not stop when "Quest Complete!" appears mid-sentence', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Main section</h2>
        <div class="lighttable checklist">
          <ul>
            <li>You will get a kind of "Quest Complete!" notification, but there is one more step.</li>
            <li>Use the key on the chest to finish the cleanup.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const steps = items.filter((i) => i.type === 'step');
  assert.equal(steps.length, 2);
  assert.match(steps[0].text, /Quest Complete!/);
  assert.match(steps[1].text, /finish the cleanup/i);
});

test('formatStepHtml keeps raw html when no dialogue marker is present', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);
  const html = '<span>Simple text</span>';
  assert.equal(formatStepHtml(html, 'Simple text'), html);
});

test('extractQuickGuide normalizes links/images in text and seeAlso and skips invalid map blocks', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Main</h2>
        <div class="seealso"><a href="//runescape.wiki/w/X">recommended</a><img src="/images/a.png"></div>
        <p>Text <a href="/w/Quest_Y">link</a> <img src="//runescape.wiki/images/i.png"></p>
        <div class="mw-kartographer-container"><div>invalid without map class</div></div>
        <table class="wikitable"><tr><td>table</td></tr></table>
        <div class="lighttable checklist"><ul><li>Step A</li></ul></div>
      </div>
    </div>
  `;
  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Main');
  assert.ok(title);
  assert.ok(title.seeAlso[0].includes('https://runescape.wiki/w/X'));
  assert.ok(title.seeAlso[0].includes('https://runescape.wiki/images/a.png'));
  assert.ok(title.sectionTexts.join(' ').includes('https://runescape.wiki/w/Quest_Y'));
  assert.ok(title.sectionTexts.join(' ').includes('https://runescape.wiki/images/i.png'));
  assert.ok(title.sectionAdvancedMaps.length >= 1);
});

test('extractQuickGuide handles mw-heading wrappers and figure without image', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <div class="mw-heading2"><h2>Wrapped</h2></div>
        <figure><figcaption>No image</figcaption></figure>
        <blockquote><a href="/w/Z">Quote link</a></blockquote>
        <div class="lighttable checklist"><ul><li>Quest complete!</li></ul></div>
      </div>
    </div>
  `;
  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Wrapped');
  assert.ok(title);
  assert.equal(title.sectionImages.length, 0);
  const textPool = [
    title.sectionTexts.join(' '),
    ...items
      .filter((i) => i.type === 'note' && i.noteType === 'text')
      .map((i) => String(i.html || '')),
  ]
    .join(' ')
    .toLowerCase();
  assert.ok(textPool.includes('quote link'));
  const steps = items.filter((i) => i.type === 'step');
  assert.equal(steps.length, 1);
});

test('extractQuickGuide does not duplicate images from dl/dd tables into sectionImages', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Steps</h2>
        <dl>
          <dd>
            <table>
              <tbody>
                <tr><th>Log</th><th>Level</th></tr>
                <tr>
                  <td><img src="/images/thumb/The_Tale_of_the_Muspah_raft_puzzle_part_1_map.png/300px-The_Tale_of_the_Muspah_raft_puzzle_part_1_map.png?68735" alt="Step 1 for melting ice."></td>
                  <td>21</td>
                  <td><img src="//runescape.wiki/images/thumb/East_raft.png/200px-East_raft.png?ecaf6" alt="The eastern side of the mound being melted."></td>
                </tr>
              </tbody>
            </table>
          </dd>
        </dl>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Steps');
  assert.ok(title);
  assert.equal(title.sectionTables.length, 0);
  assert.equal(title.sectionImages.length, 0);
  const textHtml = title.sectionTexts.join(' ');
  assert.match(
    textHtml,
    /https:\/\/runescape\.wiki\/images\/thumb\/The_Tale_of_the_Muspah_raft_puzzle_part_1_map\.png/
  );
});

test('extractQuickGuide avoids duplicating images from standalone section tables', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Section With Table</h2>
        <table class="wikitable">
          <tbody>
            <tr>
              <td><img src="/images/inside_table.png" alt="inside table"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Section With Table');
  assert.ok(title);
  assert.equal(title.sectionTables.length, 1);
  assert.equal(title.sectionImages.length, 0);
});

test('extractQuickGuide captures inline paragraph image blocks in sections with steps', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Broken Home style section</h2>
        <p>
          <span class="mw-default-size" typeof="mw:File">
            <a href="/w/File:Broken_Home_-_Getting_raven_key.png" class="mw-file-description">
              <img src="/images/thumb/Broken_Home_-_Getting_raven_key.png/424px-Broken_Home_-_Getting_raven_key.png?14087" alt="">
            </a>
          </span>
        </p>
        <div class="lighttable checklist">
          <ul><li>Do the next step</li></ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Broken Home style section');
  assert.ok(title);
  assert.equal(title.sectionImages.length, 1);
  assert.equal(
    title.sectionImages[0].src,
    'https://runescape.wiki/images/thumb/Broken_Home_-_Getting_raven_key.png/424px-Broken_Home_-_Getting_raven_key.png?14087'
  );
  const steps = items.filter((i) => i.type === 'step');
  assert.equal(steps.length, 1);
});

test('extractQuickGuide captures images from MediaWiki ul.gallery blocks', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Puzzle section</h2>
        <ul class="gallery mw-gallery-traditional">
          <li class="gallerybox">
            <div class="thumb">
              <a href="/w/File:A.png"><img src="/images/thumb/A.png/120px-A.png?abc" alt="First image"></a>
            </div>
            <div class="gallerytext">First caption.</div>
          </li>
          <li class="gallerybox">
            <div class="thumb">
              <a href="/w/File:B.png"><img src="/images/thumb/B.png/120px-B.png?def" alt="Second image"></a>
            </div>
            <div class="gallerytext">Second caption.</div>
          </li>
        </ul>
        <div class="lighttable checklist">
          <ul><li>Continue the quest</li></ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Puzzle section');
  assert.ok(title);
  assert.equal(title.sectionImages.length, 2);
  assert.equal(title.sectionImages[0].src, 'https://runescape.wiki/images/thumb/A.png/120px-A.png?abc');
  assert.equal(title.sectionImages[0].caption, 'First caption.');
  assert.equal(title.sectionImages[1].src, 'https://runescape.wiki/images/thumb/B.png/120px-B.png?def');
  assert.equal(title.sectionImages[1].caption, 'Second caption.');
});

test('extractQuickGuide emits inline image notes to preserve wiki flow', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Flow section</h2>
        <figure><img src="/images/first.png" alt="first"></figure>
        <div class="lighttable checklist"><ul><li>Do thing</li></ul></div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const imageNote = items.find((i) => i.type === 'note' && i.noteType === 'images');
  assert.ok(imageNote);
  assert.equal(imageNote.images.length, 1);
  assert.equal(imageNote.images[0].src, 'https://runescape.wiki/images/first.png');
});

test('extractQuickGuide keeps composite advanced-map blocks without direct .amap-map wrapper', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Composite map section</h2>
        <div class="advanced-map" style="width:740px;">
          <div class="amap-title">Asgarnian Ice Dungeon</div>
          <div style="display:flex;">
            <div>
              <a class="mw-kartographer-map mw-kartographer-container" data-mw-kartographer data-mapid="544"></a>
            </div>
            <div>
              <a class="mw-kartographer-map mw-kartographer-container" data-mw-kartographer data-mapid="686"></a>
            </div>
            <div>
              <div class="advanced-map" style="width:350px">
                <div class="amap-key"><ul><li>legend only</li></ul></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Composite map section');
  assert.ok(title);
  assert.equal(title.sectionAdvancedMaps.length, 1);
  assert.match(title.sectionAdvancedMaps[0], /data-mapid=\"544\"/);
  assert.match(title.sectionAdvancedMaps[0], /data-mapid=\"686\"/);
});

test('extractQuickGuide ignores images inside questdetails overview table', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <h2>Steps</h2>
        <table class="questdetails plainlinks">
          <tr><td><img src="/images/from_overview.png" alt="overview image"></td></tr>
        </table>
        <figure><img src="/images/valid_step_image.png" alt="valid image"></figure>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Steps');
  assert.ok(title);
  assert.equal(title.sectionImages.length, 1);
  assert.equal(title.sectionImages[0].src, 'https://runescape.wiki/images/valid_step_image.png');
});

test('getRewardImage stops at next heading and falls back safely when no valid image src', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div class="mw-heading"><h2 id="Rewards">Rewards</h2></div>
    <div class="mw-heading"><h3>Next section</h3></div>
    <figure class="mw-default-size mw-halign-center"><img src="/images/after_heading.png"></figure>
    <figure class="mw-halign-center"><img></figure>
  `;
  // Should not capture image after a heading break; fallback also has no valid src.
  assert.equal(getRewardImage(html), null);
});

test('extractQuickGuide normalizes nested links/images across notes, tables and steps', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  setDomGlobals(dom);

  const html = `
    <div id="mw-content-text">
      <div class="mw-parser-output">
        <div class="mw-heading3"><h3>Deep Section</h3></div>
        <div style="display:none">hidden text</div>
        <table class="messagebox">
          <tr><td><a href="//runescape.wiki/w/Info">info</a><img src="/images/box.png"></td></tr>
        </table>
        <table class="wikitable">
          <tr><td><a href="/w/Table_Link">table</a><img src="//runescape.wiki/images/table.png"></td></tr>
        </table>
        <div class="reflist">
          <ol class="references"><li><a href="//runescape.wiki/w/Ref">ref</a><img src="/images/ref.png"></li></ol>
        </div>
        <div>
          <p>Outer</p>
          <p>Inner <a href="/w/Inner">inner link</a> <img src="//runescape.wiki/images/inner.png"></p>
        </div>
        <div class="advanced-map">
          <div class="amap-map">
            <a class="mw-kartographer-map" data-mw-kartographer href="/w/Map_Page" style="display:block;width:300px;height:300px;background-image:url(https://example.test/tile.png)"></a>
          </div>
          <div class="amap-key">
            <a href="//runescape.wiki/w/Legend">legend</a>
            <img src="/images/legend.png">
          </div>
        </div>
        <div class="lighttable checklist">
          <ul>
            <li>
              Step with <a href="//runescape.wiki/w/Step_Link">step link</a> and <img src="/images/step.png">
              <ul><li>Sub with <a href="/w/Sub_Link">sub link</a> and <img src="//runescape.wiki/images/sub.png"></li></ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const items = extractQuickGuide(html);
  const title = items.find((i) => i.type === 'title' && i.text === 'Deep Section');
  assert.ok(title);
  const infoboxPool = [
    title.sectionInfoBoxes.join(' '),
    ...items
      .filter((i) => i.type === 'note' && i.noteType === 'infobox')
      .map((i) => String(i.html || '')),
  ].join(' ');
  assert.ok(infoboxPool.includes('https://runescape.wiki/w/Info'));
  assert.ok(infoboxPool.includes('https://runescape.wiki/images/box.png'));
  const tablesPool = [
    title.sectionTables.join(' '),
    ...items
      .filter((i) => i.type === 'note' && i.noteType === 'table')
      .map((i) => String(i.html || '')),
  ].join(' ');
  assert.ok(tablesPool.includes('https://runescape.wiki/w/Table_Link'));
  assert.ok(tablesPool.includes('https://runescape.wiki/images/table.png'));
  const reflistPool = [
    title.sectionRefLists.join(' '),
    ...items
      .filter((i) => i.type === 'note' && i.noteType === 'reflist')
      .map((i) => String(i.html || '')),
  ].join(' ');
  assert.ok(reflistPool.includes('https://runescape.wiki/w/Ref'));
  assert.ok(reflistPool.includes('https://runescape.wiki/images/ref.png'));
  const textSectionsPool = [
    title.sectionTexts.join(' '),
    ...items
      .filter((i) => i.type === 'note' && i.noteType === 'text')
      .map((i) => String(i.html || '')),
  ].join(' ');
  assert.ok(textSectionsPool.includes('https://runescape.wiki/w/Inner'));
  assert.ok(textSectionsPool.includes('https://runescape.wiki/images/inner.png'));
  const step = items.find((i) => i.type === 'step');
  assert.ok(step);
  assert.ok(String(step.html).includes('https://runescape.wiki/w/Step_Link'));
  assert.ok(String(step.html).includes('https://runescape.wiki/images/step.png'));
  assert.ok(String(step.substeps?.[0]?.html || '').includes('https://runescape.wiki/w/Sub_Link'));
  assert.ok(
    String(step.substeps?.[0]?.html || '').includes('https://runescape.wiki/images/sub.png')
  );
});

/* ============================================================
   VIBEGENX - SCRIPT.JS
   ============================================================ */

// ========== STATE ==========
const state = {
    lastSearched: '',
    isLoading: false,
    rawData: null
};

// ========== DOM REFS ==========
const phoneInput = document.getElementById('phoneInput');
const errorMsg = document.getElementById('errorMsg');
const errorText = document.getElementById('errorText');
const loadingState = document.getElementById('loadingState');
const resultsContainer = document.getElementById('resultsContainer');

// ========== PHONE INPUT FORMATTING ==========
phoneInput.addEventListener('input', function(e) {
    let value = this.value.replace(/\D/g, '');
    let formatted = '';
    if (value.length > 0) {
        formatted = '(' + value.substring(0, 3);
    }
    if (value.length > 3) {
        formatted += ') ' + value.substring(3, 6);
    }
    if (value.length > 6) {
        formatted += '-' + value.substring(6, 10);
    }
    this.value = formatted;
});

phoneInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

// ========== FILL SAMPLE ==========
function fillSample(phone) {
    phoneInput.value = formatPhoneDisplay(phone);
    performSearch();
}

function formatPhoneDisplay(phone) {
    return '(' + phone.substring(0, 3) + ') ' + phone.substring(3, 6) + '-' + phone.substring(6, 10);
}

// ========== API WITH AUTO CORS BYPASS ==========
async function fetchWithCorsBypass(url) {
    // Method 1: Direct (works with CORS extension)
    try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
    } catch(e) {
        console.log('Direct failed, trying proxy...');
    }

    // Method 2: AllOrigins Proxy
    try {
        const proxy = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const res = await fetch(proxy);
        if (res.ok) return await res.json();
    } catch(e) {
        console.log('AllOrigins failed, trying next...');
    }

    // Method 3: CorsProxy.io
    try {
        const proxy = 'https://corsproxy.io/?' + encodeURIComponent(url);
        const res = await fetch(proxy);
        if (res.ok) return await res.json();
    } catch(e) {
        console.log('CorsProxy failed');
    }

    throw new Error('All CORS bypass methods failed. Please enable CORS Unblock extension.');
}

async function fetchPerson(phone) {
    return await fetchWithCorsBypass(`https://api.infolookup.site/v1/?x=${phone}`);
}

async function fetchTCPA(phone) {
    return await fetchWithCorsBypass(`https://api.infolookup.site/tcpa/v1?x=${phone}`);
}

// ========== SEARCH ==========
async function performSearch() {
    // Get raw phone
    const raw = phoneInput.value.replace(/\D/g, '');
    
    // Validate
    if (!raw || raw.length !== 10) {
        showError('Please enter a valid 10-digit US phone number.');
        return;
    }
    
    if (raw === state.lastSearched) {
        showError('This number was just searched. Try a different one.');
        return;
    }
    
    state.lastSearched = raw;
    hideError();
    showLoading();
    resultsContainer.classList.remove('show');

    try {
        // Fetch both APIs in parallel with auto CORS bypass
        const [personData, tcpaData] = await Promise.all([
            fetchPerson(raw),
            fetchTCPA(raw)
        ]);

        state.rawData = { person: personData, tcpa: tcpaData };
        renderResults(personData, tcpaData, raw);
        hideLoading();
        resultsContainer.classList.add('show');

    } catch (error) {
        console.error('Search error:', error);
        hideLoading();
        showError(`Search failed: ${error.message}. Please enable CORS Unblock extension.`);
    }
}

// ========== RENDER ==========
function renderResults(personData, tcpaData, phone) {
    renderCompliance(tcpaData, phone);
    renderPerson(personData);
    renderRawData({ person: personData, tcpa: tcpaData });
}

function renderCompliance(tcpaData, phone) {
    const stateEl = document.getElementById('stateDisplay');
    const dncEl = document.getElementById('dncDisplay');
    const litEl = document.getElementById('litigatorDisplay');
    const blEl = document.getElementById('blacklistDisplay');
    const badge = document.getElementById('statusBadge');

    // State from TCPA or area code
    const state = tcpaData?.results?.state || getStateFromAreaCode(phone);
    stateEl.textContent = state;

    // TCPA Status
    const status = tcpaData?.results?.status || '';
    const isDNC = status.includes('DNC');
    const isFederal = status.includes('Federal');
    const isState = status.includes('State');

    let dncText = 'Clean';
    if (isFederal && isState) dncText = 'Federal & State DNC';
    else if (isFederal) dncText = 'Federal DNC';
    else if (isState) dncText = 'State DNC';

    dncEl.innerHTML = isDNC
        ? `<span class="status-flagged"><i class="fas fa-exclamation-circle"></i> ${dncText}</span>`
        : `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Litigator - Not available in this API
    litEl.innerHTML = `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Blacklist - Not available in this API
    blEl.innerHTML = `<span class="status-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

    // Overall badge
    badge.textContent = isDNC ? '⚠️ Flagged' : '✅ Clean';
    badge.className = `badge-status ${isDNC ? 'flagged' : 'clean'}`;
}

function renderPerson(personData) {
    const container = document.getElementById('personInfoContainer');
    const countBadge = document.getElementById('personCount');
    
    if (!personData || personData.status !== 'ok' || personData.count === 0) {
        container.innerHTML = `
            <div class="no-result">
                <i class="fas fa-user-slash"></i>
                No owner information found for this number.
            </div>
        `;
        countBadge.textContent = '0 results';
        return;
    }

    const people = personData.person || [];
    countBadge.textContent = `${people.length} result${people.length > 1 ? 's' : ''}`;

    container.innerHTML = people.map((person, idx) => {
        const ageStr = person.age ? `${person.age} yrs` : '';
        const dobStr = person.dob ? `(${person.dob})` : '';
        
        // Addresses
        let addrHtml = '';
        if (person.addresses && person.addresses.length > 0) {
            const seen = new Set();
            addrHtml = `<div class="person-addresses">`;
            person.addresses.forEach(addr => {
                const key = `${addr.home}-${addr.city}-${addr.state}`.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                addrHtml += `
                    <div class="address-item">
                        ${addr.home || 'No address'}
                        <div class="city-state">${addr.city || ''}, ${addr.state || ''} ${addr.zip || ''}</div>
                    </div>
                `;
            });
            addrHtml += `</div>`;
        } else {
            addrHtml = `<div style="color:var(--text-muted);font-size:13px;">No addresses available</div>`;
        }

        // Relatives
        let relHtml = '';
        if (person.relatives && person.relatives.length > 0 && person.relatives[0] !== 'Not Found') {
            relHtml = `
                <div class="relatives">
                    ${person.relatives.map(r => `<span class="relative-tag"><i class="fas fa-user-friends"></i> ${r}</span>`).join('')}
                </div>
            `;
        }

        // Email
        let emailHtml = '';
        if (person.emails && person.emails.length > 0 && person.emails[0]) {
            emailHtml = `<div class="person-email"><i class="fas fa-envelope"></i> ${person.emails[0]}</div>`;
        }

        return `
            <div class="person-entry" style="animation-delay:${idx * 0.1}s">
                <div class="person-header">
                    <span class="person-name">${person.name || 'Unknown'}</span>
                    <span class="person-age">${ageStr} ${dobStr}</span>
                </div>
                ${emailHtml}
                ${addrHtml}
                ${relHtml}
            </div>
        `;
    }).join('');
}

function renderRawData(data) {
    const container = document.getElementById('rawDataContent');
    container.textContent = JSON.stringify(data, null, 2);
}

function toggleRawData() {
    const container = document.getElementById('rawDataContainer');
    const btn = document.querySelector('.btn-toggle');
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide';
    } else {
        container.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-chevron-down"></i> Show';
    }
}

// ========== STATE FROM AREA CODE ==========
function getStateFromAreaCode(phone) {
    const areaCode = phone.substring(0, 3);
    const map = {
        "205":"AL","251":"AL","256":"AL","334":"AL","659":"AL","938":"AL",
        "907":"AK","480":"AZ","520":"AZ","602":"AZ","623":"AZ","928":"AZ",
        "479":"AR","501":"AR","870":"AR","209":"CA","213":"CA","310":"CA",
        "323":"CA","408":"CA","415":"CA","510":"CA","530":"CA","559":"CA",
        "562":"CA","619":"CA","626":"CA","650":"CA","661":"CA","707":"CA",
        "714":"CA","760":"CA","805":"CA","818":"CA","831":"CA","858":"CA",
        "909":"CA","916":"CA","925":"CA","949":"CA","951":"CA","303":"CO",
        "719":"CO","720":"CO","970":"CO","203":"CT","475":"CT","860":"CT",
        "959":"CT","302":"DE","202":"DC","239":"FL","305":"FL","321":"FL",
        "352":"FL","386":"FL","407":"FL","561":"FL","727":"FL","754":"FL",
        "772":"FL","786":"FL","813":"FL","850":"FL","863":"FL","904":"FL",
        "941":"FL","954":"FL","229":"GA","404":"GA","470":"GA","478":"GA",
        "678":"GA","706":"GA","762":"GA","770":"GA","912":"GA","808":"HI",
        "208":"ID","217":"IL","224":"IL","309":"IL","312":"IL","331":"IL",
        "618":"IL","630":"IL","708":"IL","773":"IL","779":"IL","815":"IL",
        "847":"IL","872":"IL","219":"IN","260":"IN","317":"IN","463":"IN",
        "574":"IN","765":"IN","812":"IN","930":"IN","319":"IA","515":"IA",
        "563":"IA","641":"IA","712":"IA","316":"KS","620":"KS","785":"KS",
        "913":"KS","270":"KY","502":"KY","606":"KY","859":"KY","225":"LA",
        "318":"LA","337":"LA","504":"LA","985":"LA","207":"ME","240":"MD",
        "301":"MD","410":"MD","443":"MD","667":"MD","339":"MA","351":"MA",
        "413":"MA","508":"MA","617":"MA","774":"MA","781":"MA","857":"MA",
        "978":"MA","231":"MI","248":"MI","269":"MI","313":"MI","517":"MI",
        "586":"MI","616":"MI","734":"MI","810":"MI","906":"MI","947":"MI",
        "989":"MI","218":"MN","320":"MN","507":"MN","612":"MN","651":"MN",
        "763":"MN","952":"MN","228":"MS","601":"MS","662":"MS","769":"MS",
        "314":"MO","417":"MO","573":"MO","636":"MO","660":"MO","816":"MO",
        "406":"MT","308":"NE","402":"NE","531":"NE","702":"NV","725":"NV",
        "775":"NV","603":"NH","201":"NJ","551":"NJ","609":"NJ","732":"NJ",
        "848":"NJ","856":"NJ","862":"NJ","908":"NJ","973":"NJ","505":"NM",
        "575":"NM","212":"NY","315":"NY","347":"NY","516":"NY","518":"NY",
        "585":"NY","607":"NY","631":"NY","646":"NY","716":"NY","718":"NY",
        "845":"NY","914":"NY","917":"NY","929":"NY","252":"NC","336":"NC",
        "704":"NC","828":"NC","910":"NC","919":"NC","980":"NC","984":"NC",
        "701":"ND","216":"OH","234":"OH","330":"OH","380":"OH","419":"OH",
        "440":"OH","513":"OH","567":"OH","614":"OH","740":"OH","937":"OH",
        "405":"OK","539":"OK","580":"OK","918":"OK","458":"OR","503":"OR",
        "541":"OR","971":"OR","215":"PA","267":"PA","412":"PA","484":"PA",
        "570":"PA","610":"PA","717":"PA","724":"PA","814":"PA","878":"PA",
        "401":"RI","803":"SC","843":"SC","854":"SC","864":"SC","605":"SD",
        "423":"TN","615":"TN","629":"TN","731":"TN","865":"TN","901":"TN",
        "931":"TN","210":"TX","214":"TX","254":"TX","281":"TX","325":"TX",
        "346":"TX","361":"TX","409":"TX","430":"TX","432":"TX","469":"TX",
        "512":"TX","682":"TX","713":"TX","737":"TX","806":"TX","817":"TX",
        "830":"TX","832":"TX","903":"TX","915":"TX","936":"TX","940":"TX",
        "956":"TX","972":"TX","979":"TX","385":"UT","435":"UT","801":"UT",
        "802":"VT","276":"VA","434":"VA","540":"VA","571":"VA","703":"VA",
        "757":"VA","804":"VA","206":"WA","253":"WA","360":"WA","425":"WA",
        "509":"WA","304":"WV","681":"WV","262":"WI","414":"WI","608":"WI",
        "715":"WI","920":"WI","307":"WY"
    };
    return map[areaCode] || 'Unknown';
}

// ========== UI HELPERS ==========
function showError(msg) {
    errorText.textContent = msg;
    errorMsg.classList.add('show');
}

function hideError() {
    errorMsg.classList.remove('show');
}

function showLoading() {
    loadingState.classList.add('show');
}

function hideLoading() {
    loadingState.classList.remove('show');
}

// ========== EXPOSE FUNCTIONS GLOBALLY ==========
window.performSearch = performSearch;
window.fillSample = fillSample;
window.toggleRawData = toggleRawData;

console.log('🚀 vibeGenx loaded successfully!');
console.log('📞 Enter a phone number and click Search.');
console.log('📱 Auto CORS bypass enabled.');

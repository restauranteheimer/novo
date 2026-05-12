// ==================== MAP.JS ====================
let map = null, currentMarker = null, selectedAddress = "";

function initMapWithGPS() {
    if(map) map.remove();
    let defaultLat = -7.933, defaultLng = -34.873;
    document.getElementById('mapModal').style.display = 'flex';
    setTimeout(() => {
        if(map) map.remove();
        map = L.map('map').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' }).addTo(map);
        if(currentMarker) map.removeLayer(currentMarker);
        currentMarker = L.marker([defaultLat, defaultLng]).addTo(map);
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                let {latitude, longitude} = pos.coords;
                map.setView([latitude, longitude], 15);
                if(currentMarker) map.removeLayer(currentMarker);
                currentMarker = L.marker([latitude, longitude]).addTo(map);
                reverseGeocode(latitude, longitude);
            }, err => { console.warn(err); reverseGeocode(defaultLat, defaultLng); });
        } else reverseGeocode(defaultLat, defaultLng);
        async function reverseGeocode(lat, lng) {
            try {
                let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`);
                let data = await res.json();
                selectedAddress = data.display_name || `${lat}, ${lng}`;
                document.getElementById('addressSearchInput').value = selectedAddress;
            } catch(e) { selectedAddress = `${lat}, ${lng}`; }
        }
        map.on('click', async e => {
            if(currentMarker) map.removeLayer(currentMarker);
            currentMarker = L.marker(e.latlng).addTo(map);
            try {
                let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&accept-language=pt-BR`);
                let data = await res.json();
                selectedAddress = data.display_name || `${e.latlng.lat}, ${e.latlng.lng}`;
                document.getElementById('addressSearchInput').value = selectedAddress;
            } catch(e) { selectedAddress = `${e.latlng.lat}, ${e.latlng.lng}`; }
        });
    }, 100);
}

async function searchAddress() {
    let q = document.getElementById('addressSearchInput').value;
    if(!q) return;
    let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`);
    let data = await res.json();
    if(data.length) {
        let {lat, lon, display_name} = data[0];
        map.setView([parseFloat(lat), parseFloat(lon)], 16);
        if(currentMarker) map.removeLayer(currentMarker);
        currentMarker = L.marker([parseFloat(lat), parseFloat(lon)]).addTo(map);
        selectedAddress = display_name;
        document.getElementById('addressSearchInput').value = display_name;
    } else alert('Endereço não encontrado');
}

function useLocationFromMap() {
    if(selectedAddress) document.getElementById('appointmentLocation').value = selectedAddress;
    document.getElementById('mapModal').style.display = 'none';
}

function getCurrentLocationGPS() {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            let {latitude, longitude} = pos.coords;
            map.setView([latitude, longitude], 16);
            if(currentMarker) map.removeLayer(currentMarker);
            currentMarker = L.marker([latitude, longitude]).addTo(map);
            reverseGeocodeNow(latitude, longitude);
        }, err => alert('Não foi possível obter localização'));
    } else alert('Geolocalização não suportada');
    async function reverseGeocodeNow(lat,lng){
        let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt-BR`);
        let data = await res.json();
        selectedAddress = data.display_name || `${lat}, ${lng}`;
        document.getElementById('addressSearchInput').value = selectedAddress;
    }
}

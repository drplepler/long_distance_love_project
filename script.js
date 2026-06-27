// City coordinates (loaded from JSON file)
const amsterdamCoords = { x: 45, y: 5 }; // percentage on map - moved up and left
const haifaCoords = { x: 56.2, y: 95.2 }; // percentage on map - tiny adjustment right and down

const plane = document.getElementById('plane');
const planeImage = document.getElementById('planeImage');
const mapWrapper = document.querySelector('.map-wrapper');
const amsterdam = document.getElementById('amsterdam');
const haifa = document.getElementById('haifa');

let lastDirection = 'right'; // Track last direction for image switching

// Set plane position - follows path from Amsterdam to Haifa with wave pattern
function setPlanePosition(progress) {
    // Get screen positions of city markers
    const amsterdamRect = amsterdam.getBoundingClientRect();
    const haifaRect = haifa.getBoundingClientRect();
    
    // Calculate screen positions as percentages
    const amsterdamScreenX = (amsterdamRect.left + amsterdamRect.width / 2) / window.innerWidth * 100;
    const amsterdamScreenY = (amsterdamRect.top + amsterdamRect.height / 2) / window.innerHeight * 100;
    const haifaScreenX = (haifaRect.left + haifaRect.width / 2) / window.innerWidth * 100;
    const haifaScreenY = (haifaRect.top + haifaRect.height / 2) / window.innerHeight * 100;
    
    // Clamp Y positions to reasonable screen range (15% to 85%)
    const clampedAmsterdamY = Math.max(15, Math.min(85, amsterdamScreenY));
    const clampedHaifaY = Math.max(15, Math.min(85, haifaScreenY));
    
    // Linear interpolation between Amsterdam and Haifa screen positions
    const baseX = amsterdamScreenX + (haifaScreenX - amsterdamScreenX) * progress;
    const baseY = clampedAmsterdamY + (clampedHaifaY - clampedAmsterdamY) * progress;
    
    // Add wave pattern perpendicular to the path
    const waveAmplitude = 5; // How far the wave goes perpendicular to path
    const waveFrequency = 3; // How many waves
    const waveOffset = Math.sin(progress * Math.PI * waveFrequency) * waveAmplitude;
    
    // Calculate perpendicular direction for wave
    const pathAngle = Math.atan2(haifaScreenY - amsterdamScreenY, haifaScreenX - amsterdamScreenX);
    const perpAngle = pathAngle + Math.PI / 2;
    
    // Apply wave offset perpendicular to path
    const x = baseX + Math.cos(perpAngle) * waveOffset;
    const y = baseY + Math.sin(perpAngle) * waveOffset;
    
    // Calculate next position for direction detection
    const nextProgress = Math.min(progress + 0.01, 1);
    const nextBaseX = amsterdamScreenX + (haifaScreenX - amsterdamScreenX) * nextProgress;
    const nextBaseY = amsterdamScreenY + (haifaScreenY - amsterdamScreenY) * nextProgress;
    const nextWaveOffset = Math.sin(nextProgress * Math.PI * waveFrequency) * waveAmplitude;
    const nextX = nextBaseX + Math.cos(perpAngle) * nextWaveOffset;
    const nextY = nextBaseY + Math.sin(perpAngle) * nextWaveOffset;
    
    // Determine direction based on horizontal movement
    const deltaX = nextX - x;
    const currentDirection = deltaX >= 0 ? 'right' : 'left';
    
    // Switch plane image based on direction
    if (currentDirection !== lastDirection) {
        if (currentDirection === 'right') {
            planeImage.src = 'plane_cartoo_v1_right.png';
        } else {
            planeImage.src = 'plane_cartoo_v1_left.png';
        }
        lastDirection = currentDirection;
    }
    
    plane.style.left = `${x}%`;
    plane.style.top = `${y}%`;
}

// Move map vertically based on scroll
function moveMap(progress) {
    // Map moves from 0 to -100vh (scrolls up as user scrolls down)
    const mapOffset = -progress * 100; // in vh units
    mapWrapper.style.transform = `translateY(${mapOffset}vh)`;
}

// Update city marker positions based on map
function updateCityMarkers() {
    amsterdam.style.left = `${amsterdamCoords.x}%`;
    amsterdam.style.top = `${amsterdamCoords.y}%`;
    haifa.style.left = `${haifaCoords.x}%`;
    haifa.style.top = `${haifaCoords.y}%`;
}

// Scroll handler - very long scroll for slow animation
function handleScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = Math.min(scrollTop / docHeight, 1);
    
    setPlanePosition(scrollProgress);
    moveMap(scrollProgress);
}

// Initialize
updateCityMarkers();
setPlanePosition(0);

// Listen for scroll
window.addEventListener('scroll', handleScroll);

// Adjust these coordinates after you add your map image
// You can tweak amsterdamCoords and haifaCoords to match your map

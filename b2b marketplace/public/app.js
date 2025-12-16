// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCBd7O4cZ8LX1dgTiTZt4NcU5NJVm4Blak",
    authDomain: "aetheron-2b3b4.firebaseapp.com",
    projectId: "aetheron-2b3b4",
    storageBucket: "aetheron-2b3b4.firebasestorage.app",
    messagingSenderId: "240923034323",
    appId: "1:240923034323:web:4dc8e5e029e953a41e8a26"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global functions for authentication and user tracking
function renderAuthButtons(user) {
    const authArea = document.getElementById('authArea');
    if (!authArea) return;
    authArea.innerHTML = "";
    if (user) {
        const greeting = document.createElement('span');
        greeting.className = "font-semibold text-purple-700 mr-2";
        greeting.textContent = `${user.displayName || user.email.split("@")[0]}`;
        authArea.appendChild(greeting);

        const dashboardBtn = document.createElement('button');
        dashboardBtn.textContent = "Dashboard";
        dashboardBtn.className = "bg-purple-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-purple-700 transition mr-2";
        dashboardBtn.onclick = () => window.location.href = "admin.html";
        authArea.appendChild(dashboardBtn);

        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = "Logout";
        logoutBtn.className = "bg-gray-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-gray-700 transition";
        logoutBtn.onclick = () => auth.signOut().then(() => location.reload());
        authArea.appendChild(logoutBtn);
    } else {
        const googleBtn = document.createElement('button');
        googleBtn.textContent = "Join Competition";
        googleBtn.className = "bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:shadow-lg transition";
        googleBtn.onclick = async () => {
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                await db.collection('startups').doc(user.uid).set({
                    uid: user.uid,
                    name: user.displayName || user.email.split("@")[0],
                    email: user.email,
                    signupDate: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    competitionEntry: true,
                    aiCapabilities: [],
                    matchingScore: 0
                }, { merge: true });
                location.reload();
            } catch (error) {
                console.error("Authentication error:", error);
                alert("Authentication failed. Please try again.");
            }
        };
        authArea.appendChild(googleBtn);
    }
}

auth.onAuthStateChanged(user => renderAuthButtons(user));

// Page-specific logic based on URL
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));

    const path = window.location.pathname;

    if (path.endsWith("lend-ai-service.html")) {
        setupSubmissionPage();
    } else if (path.endsWith("contact.html")) {
        setupContactPage();
    } else if (path.endsWith("admin.html")) {
        setupAdminPage();
    } else if (path.endsWith("marketplace.html")) {
        setupMarketplacePage();
    }
});

// ---
// Page Functions
// ---

function setupSubmissionPage() {
    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = "index.html";
        else document.getElementById('contactEmail').value = user.email || "";
    });

    const lendForm = document.getElementById('lendForm');
    if (lendForm) {
        lendForm.onsubmit = async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert("Please log in first.");

            const submitBtn = lendForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Submitting...';
            submitBtn.disabled = true;

            const serviceData = {
                userId: user.uid,
                serviceName: lendForm.serviceName.value.trim(),
                startupName: lendForm.startupName.value.trim(),
                serviceDescription: lendForm.serviceDescription.value.trim(),
                industry: lendForm.industry.value,
                aiCapabilities: lendForm.aiCapabilities.value.split(',').map(s => s.trim()),
                contactEmail: lendForm.contactEmail.value.trim(),
                website: lendForm.website.value.trim(),
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending review',
                competitionEntry: true
            };

            try {
                await db.collection('aiServices').add(serviceData);
                
                const successMessage = document.getElementById('successMessage');
                if (successMessage) {
                     successMessage.classList.remove('hidden');
                }
                
                lendForm.reset();
                document.getElementById('contactEmail').value = user.email || "";
            } catch (error) {
                console.error("Error adding document: ", error);
                alert("Submission failed: " + error.message);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        };
    }
}

function setupContactPage() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;

            try {
                await db.collection('competitionInquiries').add({
                    name: contactForm.name.value,
                    email: contactForm.email.value,
                    message: contactForm.message.value,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    source: 'competition'
                });
                
                const responseMessage = document.getElementById('responseMessage');
                if (responseMessage) {
                    responseMessage.textContent = "Thank you! We'll respond within 24 hours.";
                    responseMessage.classList.remove('hidden');
                }
                contactForm.reset();
            } catch (error) {
                console.error("Error submitting contact form: ", error);
                alert("Failed to send message: " + error.message);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        };
    }
}

function setupAdminPage() {
    displayCompetitionMetrics();
    displayAIServices();
}

function setupMarketplacePage() {
    loadMarketplaceServices();
}

// ---
// Helper Functions (moved outside DOMContentLoaded)
// ---

async function displayCompetitionMetrics() {
    const container = document.getElementById('competitionMetrics');
    if (!container) return;

    db.collection('aiServices').where('competitionEntry', '==', true)
        .onSnapshot(snapshot => {
            const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const analyzed = services.filter(s => s.status === 'analyzed').length;
            const highPotential = services.filter(s => s.matchingPotential > 70).length;
            
            container.innerHTML = `
                <div class="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-6 rounded-xl mb-6">
                    <h3 class="text-xl font-bold mb-4">Competition Metrics</h3>
                    <div class="grid md:grid-cols-3 gap-4">
                        <div class="text-center">
                            <div class="text-2xl font-bold">${services.length}</div>
                            <div class="text-purple-200">Total Submissions</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold">${analyzed}</div>
                            <div class="text-purple-200">AI Analyzed</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold">${highPotential}</div>
                            <div class="text-purple-200">High-Potential Matches</div>
                        </div>
                    </div>
                </div>
            `;
        });
}

async function displayAIServices() {
    const serviceList = document.getElementById('serviceList');
    if (!serviceList) return;

    db.collection('aiServices').where('competitionEntry', '==', true)
        .orderBy('submittedAt', 'desc').limit(10)
        .onSnapshot(snapshot => {
            serviceList.innerHTML = "";
            snapshot.forEach(doc => {
                const s = doc.data();
                const statusColor = s.status === 'analyzed' ? 'text-green-600' : 'text-yellow-600';
                const potentialBadge = s.matchingPotential > 70 ? 
                    '<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">High Potential</span>' : 
                    '<span class="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-semibold">Pending Analysis</span>';
                
                const div = document.createElement('div');
                div.className = "p-6 rounded-xl border bg-white shadow hover:shadow-lg transition-all";
                div.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="font-bold text-lg text-purple-700">${s.serviceName}</div>
                            <div class="text-gray-700 mb-2">${s.serviceDescription}</div>
                            <div class="text-sm text-gray-500">Contact: ${s.contactEmail}</div>
                            <div class="text-sm ${statusColor} mt-1">Status: ${s.status}</div>
                            ${s.aiCapabilities && s.aiCapabilities.length > 0 ? 
                            `<div class="flex flex-wrap gap-1 mt-2">
                                ${s.aiCapabilities.map(cap => `<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">${cap}</span>`).join('')}
                            </div>` : ''}
                        </div>
                        <div class="ml-4 text-right">
                            ${potentialBadge}
                            ${s.matchingPotential > 0 ? `<div class="text-sm text-gray-600 mt-1">${s.matchingPotential}% match</div>` : ''}
                            <button onclick="analyzeAndSaveService('${doc.id}')" class="mt-2 text-xs text-blue-500 hover:underline">Analyze</button>
                        </div>
                    </div>
                `;
                serviceList.appendChild(div);
            });
        });
}

async function loadMarketplaceServices() {
     const grid = document.getElementById('marketplaceGrid');
     const loading = document.getElementById('loadingState');
     if (!grid || !loading) return;
    
     loading.style.display = "block";
    
     try {
        const snapshot = await db.collection("aiServices")
           .where("status", "==", "analyzed")
           .orderBy("matchingPotential", "desc")
           .limit(12)
           .get();

        loading.style.display = "none";
        if (snapshot.empty) {
            grid.innerHTML = "<p class='text-gray-600'>No AI services available at the moment.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const service = doc.data();
            const serviceCard = createServiceCard(service);
            grid.appendChild(serviceCard);
        });
     } catch (error) {
        console.error("Error loading services:", error);
        loading.innerHTML = "<p class='text-red-600'>Error loading services. Please try again later.</p>";
     }
}

function createServiceCard(service) {
    const div = document.createElement('div');
    div.className = 'p-6 bg-white rounded-xl shadow';
    div.innerHTML = `
        <h3 class="font-bold text-lg">${service.serviceName}</h3>
        <p class="text-sm text-gray-600">${service.serviceDescription}</p>
        <div class="mt-2 text-sm">
            <strong>Industry:</strong> ${service.industry || 'N/A'}<br>
            <strong>Matching Score:</strong> ${service.matchingPotential || 0}%
        </div>
    `;
    return div;
}

async function analyzeAndSaveService(serviceId) {
    // This function should be implemented as a Cloud Function in a real application
    // It's not secure to call an external API directly from the client.
    alert("This function should be run on the backend to be secure.");
    console.log(`Simulating analysis for service ID: ${serviceId}`);
}
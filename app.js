// State machine for booking process
const states = {
    IDLE: 'idle',
    ASKING_DATE: 'asking_date',
    ASKING_TIME: 'asking_time',
    ASKING_TICKETS: 'asking_tickets',
    ASKING_PAYMENT: 'asking_payment',
    CONFIRMING: 'confirming',
    COMPLETED: 'completed'
};

let currentState = states.IDLE;

// Pricing configuration
const ticketPrice = 15; // $15 per ticket
const discountThreshold = 5; // 5+ tickets get discount
const discountRate = 0.1; // 10% discount

let bookingData = {
    date: null,
    time: null,
    tickets: null,
    paymentMethod: null,
    price: null
};

// DOM elements
const micButton = document.getElementById('mic-button');
const chatMessages = document.getElementById('chat-messages');
const statusElement = document.getElementById('status');
const bookingSummary = document.getElementById('booking-summary');

// Speech recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = false;
recognition.maxAlternatives = 1;

// Speech synthesis setup
const synth = window.speechSynthesis;
synth.onerror = (event) => {
    console.error('Speech synthesis error', event);
    addBotMessage("Sorry, I'm having trouble speaking. Please continue with text.");
};

// Initialize
addBotMessage("Welcome to the Museum Ticket Booking System. Please click the microphone and tell me when you'd like to visit.");

// Event listeners
micButton.addEventListener('click', toggleMic);

function toggleMic() {
    if (micButton.classList.contains('mic-on')) {
        recognition.stop();
        micButton.classList.remove('mic-on');
        statusElement.textContent = "Microphone off. Click to speak...";
    } else {
        recognition.start();
        micButton.classList.add('mic-on');
        statusElement.textContent = "Listening... Speak now";
    }
}

let isProcessing = false;
recognition.onresult = (event) => {
    if (isProcessing) return;
    isProcessing = true;
    
    try {
        const transcript = event.results[0][0].transcript;
        addUserMessage(transcript);
        processCommand(transcript);
    } finally {
        setTimeout(() => {
            isProcessing = false;
            if (micButton.classList.contains('mic-on')) {
                recognition.start();
            }
        }, 500);
    }
};

recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    statusElement.textContent = "Error occurred. Click microphone to try again.";
    micButton.classList.remove('mic-on');
};

function processCommand(command) {
    command = command.toLowerCase().trim();
    
    switch(currentState) {
        case states.IDLE:
            if (command.includes('book') || command.includes('ticket')) {
                transitionToState(states.ASKING_DATE);
            } else {
                speak("Sorry, I didn't understand that. Say 'book tickets' to start.");
                addBotMessage("Say 'book tickets' to begin your museum visit booking.");
            }
            break;
            
        case states.ASKING_DATE:
            const dateMatch = command.match(/\b(today|tomorrow|\d{1,2}\/\d{1,2}\/\d{4})\b/i);
            if (dateMatch) {
                bookingData.date = dateMatch[0];
                transitionToState(states.ASKING_TIME);
            } else {
                speak("Sorry, I didn't understand that date. Please try again.");
                addBotMessage("Please say a valid date like 'today', 'tomorrow', or 'MM/DD/YYYY'.");
            }
            break;
            
        case states.ASKING_TIME:
            const timeMatch = command.match(/\b(\d{1,2}(:\d{2})?\s?(am|pm)?)\b/i);
            if (timeMatch) {
                bookingData.time = timeMatch[0];
                transitionToState(states.ASKING_TICKETS);
            } else {
                speak("Sorry, I didn't understand that time. Please try again.");
                addBotMessage("Please say a valid time like '10am', '2:30pm', or '15:00'.");
            }
            break;
            
        case states.ASKING_TICKETS:
            const ticketMatch = command.match(/\b(\d+)\b/);
            if (ticketMatch) {
                const numTickets = parseInt(ticketMatch[0]);
                if (numTickets > 0 && numTickets <= 10) {
                    bookingData.tickets = numTickets;
                    // Calculate price
                    let price = numTickets * ticketPrice;
                    if (numTickets >= discountThreshold) {
                        price *= (1 - discountRate);
                    }
                    bookingData.price = price.toFixed(2);
                    transitionToState(states.ASKING_PAYMENT);
                } else {
                    speak("Sorry, you can book between 1 and 10 tickets. Please try again.");
                    addBotMessage("Please choose between 1 and 10 tickets.");
                }
            } else {
                speak("Sorry, I didn't catch the number of tickets. Please say a number between 1 and 10.");
                addBotMessage("Please say how many tickets you'd like (1-10).");
            }
            break;
            
        case states.CONFIRMING:
            if (command.includes('yes') || command.includes('confirm')) {
                completeBooking();
            } else if (command.includes('no') || command.includes('cancel')) {
                cancelBooking();
            }
            break;
    }
}

function transitionToState(newState) {
    currentState = newState;
    
    switch(newState) {
        case states.ASKING_DATE:
            speak("What date would you like to visit? You can say today, tomorrow, or a specific date.");
            addBotMessage("What date would you like to visit?");
            break;
            
        case states.ASKING_TIME:
            speak("What time would you like to visit?");
            addBotMessage("What time would you like to visit?");
            break;
            
        case states.ASKING_TICKETS:
            speak("How many tickets would you like?");
            addBotMessage("How many tickets would you like?");
            break;
            
        case states.ASKING_PAYMENT:
            speak("Please select your payment method by clicking one of the buttons.");
            addBotMessage("Please select your payment method:");
            bookingSummary.innerHTML = `
                <div class="payment-methods">
                    <button onclick="setPaymentMethod('credit')">Credit Card</button>
                    <button onclick="setPaymentMethod('paypal')">PayPal</button>
                    <button onclick="setPaymentMethod('cash')">Cash</button>
                </div>
            `;
            bookingSummary.style.display = 'block';
            break;
            
        case states.CONFIRMING:
            const summary = `Please confirm: ${bookingData.tickets} ticket(s) for ${bookingData.date} at ${bookingData.time}. Total: $${bookingData.price}. Payment method: ${bookingData.paymentMethod}. Is this correct?`;
            speak(summary);
            addBotMessage(summary);
            break;
            
        case states.COMPLETED:
            speak("Your museum tickets have been booked! Thank you.");
            showBookingSummary();
            break;
    }
}

function completeBooking() {
    currentState = states.COMPLETED;
    transitionToState(states.COMPLETED);
}

function cancelBooking() {
    currentState = states.IDLE;
    bookingData = { date: null, time: null, tickets: null };
    speak("Booking cancelled. Would you like to start over?");
    addBotMessage("Booking cancelled. Would you like to start over?");
}

function showBookingSummary() {
    bookingSummary.innerHTML = `
        <h3>Booking Confirmed</h3>
        <p>Date: ${bookingData.date}</p>
        <p>Time: ${bookingData.time}</p>
        <p>Tickets: ${bookingData.tickets}</p>
        <p>Total Paid: $${bookingData.price}</p>
        <p>Payment Method: ${formatPaymentMethod(bookingData.paymentMethod)}</p>
    `;
    bookingSummary.style.display = 'block';
}

function addBotMessage(text) {
    const message = document.createElement('div');
    message.classList.add('bot-message');
    message.textContent = `Bot: ${text}`;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(text) {
    const message = document.createElement('div');
    message.classList.add('user-messge');
    message.textContent = `You: ${text}`;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function speak(text) {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
        if (micButton.classList.contains('mic-on')) {
            recognition.start();
        }
    };
    synth.speak(utterance);
}

function setPaymentMethod(method) {
    bookingData.paymentMethod = method;
    transitionToState(states.CONFIRMING);
}

function formatPaymentMethod(method) {
    switch(method) {
        case 'credit': return 'Credit Card';
        case 'paypal': return 'PayPal';
        case 'cash': return 'Cash';
        default: return 'Not selected';
    }
}

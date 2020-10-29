var WINDOWBORDERSIZE = 10;
var HUGE = 999999; //Sometimes useful when testing for big or small numbers
var animationDelay = 200; //controls simulation and transition speed
var isRunning = false; // used in simStep and toggleSimStep
var surface; // Set in the redrawWindow function. It is the D3 selection of the svg drawing surface
var simTimer; // Set in the initialization function

//The drawing surface will be divided into logical cells
var maxCols = 40;
var cellWidth; //cellWidth is calculated in the redrawWindow function
var cellHeight; //cellHeight is calculated in the redrawWindow function

// TODO: Add IMAGES
const urlPassenger = "images/Superintendant_storing.png";
const urlSeat = "images/airplane_seat.png";
const urlPassengerStoring = "images/Superintendant.png";

// A passenger enters the airplane QUEUEING to reach their seat row;
// Then STORING luggage; then proceed to SEATING then SEATED;
const WAITING = -1;
const QUEUEING = 0;
const STORING = 1;
const SEATING = 2;
const SEATED = 3;

// passengers is a dynamic list, initially empty
var passengers = [];
// idCount holds the running count of passengerIDs
var idCount = 1;

// We can section our screen into different areas. In this model, the seating area and aisle are separate
const numRowSeats = 35;
const numSeatsInRow = 6;
const numPassengers = numRowSeats * numSeatsInRow;

const aisleStartCol = 4;
const aisleStartRow = 8;
const queueStartCol = 0;

var areas = [
    { "label": "Top Seating Area", "startRow": aisleStartRow - numSeatsInRow / 2, "numRows": numSeatsInRow / 2, "startCol": aisleStartCol, "numCols": numRowSeats, "color": "white" },
    { "label": "Bottom Seating Area", "startRow": aisleStartRow + 1, "numRows": numSeatsInRow / 2, "startCol": aisleStartCol, "numCols": numRowSeats, "color": "white" },
    { "label": "Aisle", "startRow": aisleStartRow, "numRows": 1, "startCol": aisleStartCol, "numCols": numRowSeats, "color": "blue" }
]

var topSeatingArea = areas[0];
var bottomSeatingArea = areas[1];

// see initialiseSeatMatrix
var seatMatrix = [];

// see initialiseAisle
var aisleList = [];

var currentTime = 0;
var statistics = [
    { "name": "Total time taken to board Airplane: ", "location": { "row": 15, "col": 15 }, "timeTaken": 0 }
];

const EMPTY = -1;
const OCCUPIED = 1;

// This next function is executed when the script is loaded. It contains the page initialization code.
// DO NOT TOUCH
(function () {
    // Your page initialization code goes here
    // All elements of the DOM will be available here
    window.addEventListener("resize", redrawWindow); //Redraw whenever the window is resized
    simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
    initialiseVariables();
    redrawWindow();
})();

// DO NOT TOUCH
function toggleSimStep() {
    //this function is called by a click event on the html page. 
    isRunning = !isRunning;
    console.log("isRunning: " + isRunning);
}

function initialiseVariables() {
    currentTime = 0;
    statistics[0].timeTaken = 0;
    passengers = [];
    idCount = 1;
    initialiseAisle();
    initialiseSeatMatrix();
    assignSeats();
}

// create a list from the spawn point to the end of the airplane
// holds state of the aisle if it is empty or occupied
function initialiseAisle() {
    aisleList = [];
    for (i = 0; i < topSeatingArea.startCol + topSeatingArea.numCols; i++) {
        aisleList.push(EMPTY);
    }
}

// creates an array with each seat having a location, state, seatID, and passengerID to be assigned to the seat
function initialiseSeatMatrix() {
    var seatID = 1;
    for (i = topSeatingArea.startRow; i < topSeatingArea.startRow + topSeatingArea.numRows; i++) {
        for (j = topSeatingArea.startCol; j < topSeatingArea.startCol + topSeatingArea.numCols; j++) {
            seatMatrix.push({ "location": { "row": i, "col": j }, "state": EMPTY, "seatID": seatID, "passengerID": -1 });
            seatID++;
        }
    }
    for (i = bottomSeatingArea.startRow; i < bottomSeatingArea.startRow + bottomSeatingArea.numRows; i++) {
        for (j = bottomSeatingArea.startCol; j < bottomSeatingArea.startCol + bottomSeatingArea.numCols; j++) {
            seatMatrix.push({ "location": { "row": i, "col": j }, "state": EMPTY, "seatID": seatID, "passengerID": -1 });
            seatID++
        }
    }
}

// Modify the code below to change seat assignment logic
// Assign seats randomly
function assignSeats() {
    unassignedPassengers = [];
    count = 0;
    for (i = 1; i <= numPassengers; i++) {
        unassignedPassengers.push(i);
    }
    while (unassignedPassengers.length != 0) {
        var idx = Math.floor(Math.random() * unassignedPassengers.length);
        seatMatrix[count].passengerID = unassignedPassengers[idx];
        unassignedPassengers.splice(idx, 1);
        count++;
    }
}

// returns the location of seat assigned to passenger with passengerID
function getAssignedSeats(id) {
    for (seat of seatMatrix) {
        if (seat.passengerID == id) {
            return seat.location;
        }
    }
}

// DO NOT TOUCH
function redrawWindow() {
    isRunning = false; // used by simStep
    window.clearInterval(simTimer); // clear the Timer
    animationDelay = 550 - document.getElementById("slider1").value;
    simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds

    // Re-initialize simulation variables
    initialiseVariables();

    //resize the drawing surface; remove all its contents; 
    var drawsurface = document.getElementById("surface");
    var creditselement = document.getElementById("credits");
    var w = window.innerWidth;
    var h = window.innerHeight;
    var surfaceWidth = (w - 3 * WINDOWBORDERSIZE);
    var surfaceHeight = (h - creditselement.offsetHeight - 3 * WINDOWBORDERSIZE);

    drawsurface.style.width = surfaceWidth + "px";
    drawsurface.style.height = surfaceHeight + "px";
    drawsurface.style.left = WINDOWBORDERSIZE / 2 + 'px';
    drawsurface.style.top = WINDOWBORDERSIZE / 2 + 'px';
    drawsurface.style.border = "thick solid #0000FF"; //The border is mainly for debugging; okay to remove it
    drawsurface.innerHTML = ''; //This empties the contents of the drawing surface, like jQuery erase().

    // Compute the cellWidth and cellHeight, given the size of the drawing surface
    numCols = maxCols;
    cellWidth = surfaceWidth / numCols;
    numRows = Math.ceil(surfaceHeight / cellWidth);
    cellHeight = surfaceHeight / numRows;

    // In other functions we will access the drawing surface using the d3 library. 
    //Here we set the global variable, surface, equal to the d3 selection of the drawing surface
    surface = d3.select('#surface');
    surface.selectAll('*').remove(); // we added this because setting the inner html to blank may not remove all svg elements
    surface.style("font-size", "100%");
    // rebuild contents of the drawing surface
    updateSurface();
};

// The window is resizable, so we need to translate row and column coordinates into screen coordinates x and y
// DO NOT TOUCH
function getLocationCell(location) {
    var row = location.row;
    var col = location.col;
    var x = (col - 1) * cellWidth; //cellWidth is set in the redrawWindow function
    var y = (row - 1) * cellHeight; //cellHeight is set in the redrawWindow function
    return { "x": x, "y": y };
}

function updateSurface() {
    // This function is used to create or update most of the svg elements on the drawing surface.
    // See the function removeDynamicAgents() for how we remove svg elements

    //Select all svg elements of class "passengers" and map it to the data list called passengers
    var allPassengers = surface.selectAll(".passenger").data(passengers);

    // If the list of svg elements is longer than the data list, the excess elements are in the .exit() list
    // Excess elements need to be removed:
    allPassengers.exit().remove(); //remove all svg elements associated with entries that are no longer in the data list
    // (This remove function is needed when we resize the window and re-initialize the passengers array)

    // If the list of svg elements is shorter than the data list, the new elements are in the .enter() list.
    // The first time this is called, all the elements of data will be in the .enter() list.
    // Create an svg group ("g") for each new entry in the data list; give it class "passenger"
    var newPassengers = allPassengers.enter().append("g").attr("class", "passenger");
    //Append an image element to each new passsenger svg group, position it according to the location data, and size it to fill a cell
    newPassengers.append("svg:image")
        .attr("x", function (d) { var cell = getLocationCell(d.location); return cell.x + "px"; })
        .attr("y", function (d) { var cell = getLocationCell(d.location); return cell.y + "px"; })
        .attr("width", Math.min(cellWidth, cellHeight) + "px")
        .attr("height", Math.min(cellWidth, cellHeight) + "px")
        .attr("xlink:href", urlPassenger);

    // For the existing passengers, we want to update their location on the screen 
    // but we would like to do it with a smooth transition from their previous position.
    // D3 provides a very nice transition function allowing us to animate transformations of our svg elements.

    //First, we select the image elements in the allpatients list
    var images = allPassengers.selectAll("image");
    // Next we define a transition for each of these image elements.
    // Note that we only need to update the attributes of the image element which change
    images.transition()
        .attr("x", function (d) { var cell = getLocationCell(d.location); return cell.x + "px"; })
        .attr("y", function (d) { var cell = getLocationCell(d.location); return cell.y + "px"; })
        .attr("xlink:href", function (d) { if (d.state != WAITING && d.state != QUEUEING) return urlPassengerStoring; else return urlPassenger })
        .duration(animationDelay).ease('linear'); // This specifies the speed and type of transition we want.

    // The simulation should serve some purpose 
    // so we will compute and display the total time taken to board all passengers.
    // We created the array "statistics" for this purpose.
    // Here we will create a group for each element of the statistics array (two elements)
    var allstatistics = surface.selectAll(".statistics").data(statistics);
    var newstatistics = allstatistics.enter().append("g").attr("class", "statistics");
    // For each new statistic group created we append a text label
    newstatistics.append("text")
        .attr("x", function (d) { var cell = getLocationCell(d.location); return (cell.x + cellWidth) + "px"; })
        .attr("y", function (d) { var cell = getLocationCell(d.location); return (cell.y + cellHeight / 2) + "px"; })
        .attr("dy", ".35em")
        .text("");

    // The data in the statistics array are always being updated.
    // So, here we update the text in the labels with the updated information.
    allstatistics.selectAll("text").text(function (d) {
        var totalTimeTaken = d.timeTaken;
        return d.name + totalTimeTaken;
    }); //The toFixed() function sets the number of decimal places to display

    // Finally, we would like to draw boxes around the different areas of our system. We can use d3 to do that too.
    var allareas = surface.selectAll(".areas").data(areas);
    var newareas = allareas.enter().append("g").attr("class", "areas");
    // For each new area, append a rectangle to the group
    newareas.append("rect")
        .attr("x", function (d) { return (d.startCol - 1) * cellWidth; })
        .attr("y", function (d) { return (d.startRow - 1) * cellHeight; })
        .attr("width", function (d) { return d.numCols * cellWidth; })
        .attr("height", function (d) { return d.numRows * cellWidth; })
        .style("fill", function (d) { return d.color; })
        .style("stroke", "black")
        .style("stroke-width", 1);

    var allSeats = surface.selectAll(".seatMatrix").data(seatMatrix);
    //This is not a dynamic class of agents so we only need to set the svg elements for the entering data elements.
    // We don't need to worry about updating these agents or removing them
    // Create an svg group ("g") for each new entry in the data list; give it class "seatMatrix"
    var newSeats = allSeats.enter().append("g").attr("class", "seatMatrix");
    newSeats.append("svg:image")
        .attr("x", function (d) { var cell = getLocationCell(d.location); return cell.x + "px"; })
        .attr("y", function (d) { var cell = getLocationCell(d.location); return cell.y + "px"; })
        .attr("width", Math.min(cellWidth, cellHeight) + "px")
        .attr("height", Math.min(cellWidth, cellHeight) + "px")
        .attr("xlink:href", urlSeat);
}

// generate new passengers as long as number of passengers is less than total number of seats
function addDynamicAgents(counter) {
    // counter % 2 controls the intervals when we add new passengers
    // set to 2 so that every even time then we generate a new passenger
    if (idCount <= numPassengers && aisleList[queueStartCol] == EMPTY && counter % 2 == 0) {
        var assignedSeatLocation = getAssignedSeats(idCount);
        var newPassenger = {
            "id": idCount, "location": { "row": aisleStartRow, "col": queueStartCol },
            "target": { "row": aisleStartRow, "col": assignedSeatLocation.col },
            "assignedSeat": { "row": assignedSeatLocation.row, "col": assignedSeatLocation.col },
            "state": QUEUEING,
            "baggageStoringTimeStart": -1,
        };
        idCount++;
        passengers.push(newPassenger);
    }
}

// DO NOT TOUCH
function updateDynamicAgents() {
    // loop over all the agents and update their states
    for (var passengerIndex in passengers) {
        updatePassenger(passengerIndex);
    }
    updateSurface();
}

// DO NOT TOUCH
function simStep() {
    //This function is called by a timer; if running, it executes one simulation step 
    //The timing interval is set in the page initialization function near the top of this file
    if (isRunning) { //the isRunning variable is toggled by toggleSimStep
        // Increment current time (for computing statistics)
        currentTime++;
        // Sometimes new agents will be created in the following function
        addDynamicAgents(currentTime);
        // In the next function we update each agent
        updateDynamicAgents();
        getStatistics();
    }
}

// Used to generate statistics (time taken)
function getStatistics() {
    var seatedPassengers = passengers.filter(function (d) { return d.state == SEATED });
    if (seatedPassengers.length < numPassengers) {
        statistics[0].timeTaken = currentTime;
    }
}

function updatePassenger(passengerIndex) {
    // passengerIndex is an index into the passengers data array
    // it seems passengerIndex was coming in as a string
    var passenger = passengers[passengerIndex];
    // get the current location of the passenger
    var row = passenger.location.row;
    var col = passenger.location.col;
    var state = passenger.state;

    // determine if passenger has arrived at destination
    var hasArrived = (Math.abs(passenger.target.row - row) + Math.abs(passenger.target.col - col)) == 0;
    // determine if passenger has reached his assigned seat
    var isSeated = (Math.abs(passenger.assignedSeat.row - row) + Math.abs(passenger.assignedSeat.col - col)) == 0;

    switch (state) {
        case WAITING:
            // wait for next place in aisleList to be empty.
            aisleList[col] = OCCUPIED;
            // if the location in front of him becomes empty, swtich state back to queueing
            if (aisleList[col + 1] == EMPTY) {
                passenger.state = QUEUEING;
            }

            break;

        case QUEUEING:
            // Update aisleList that there is a passenger at current location
            aisleList[col] = OCCUPIED;
            if (aisleList[col + 1] == EMPTY) {
                // proceed forward if the next place in aisle is empty
                passenger.location.row = updatePassengerLocation(passenger.target.row, passenger.target.col, row, col)[0];
                passenger.location.col = updatePassengerLocation(passenger.target.row, passenger.target.col, row, col)[1];
                aisleList[col] = EMPTY;
            } else {
                // wait for next place in aisleList to be empty.
                passenger.state = WAITING;
            }
            // if passenger has arrived to location to store his baggage
            if (hasArrived) {
                passenger.state = STORING;
                // initialise baggageStoringTimeStart to current time
                passenger.baggageStoringTimeStart = currentTime;
            }

            break;

        case STORING:
            // Update aisleList that there is a passenger at current location
            aisleList[col] = OCCUPIED;
            // wait x amount of time for baggage storing to be complete
            // if x amount of time has passed, change state to STORING
            if (currentTime - passenger.baggageStoringTimeStart == 10) {
                passenger.state = SEATING
            }

            break;

        case SEATING:
            // update new target location to be passenger's assigned seat
            passenger.target.col = passenger.assignedSeat.col;
            passenger.target.row = passenger.assignedSeat.row;
            // send passenger to his assigned seat
            passenger.location.row = updatePassengerLocation(passenger.target.row, passenger.target.col, row, col)[0];
            passenger.location.col = updatePassengerLocation(passenger.target.row, passenger.target.col, row, col)[1];
            aisleList[col] = EMPTY;

            if (isSeated) {
                passenger.state = SEATED;
            }

            break;


        default:
            break;
    }
}

function updatePassengerLocation(targetRow, targetCol, row, col) {
    var cellsPerStep = 1;
    var rowsToGo = targetRow - row;
    var colsToGo = targetCol - col;
    var newRow = row + Math.min(Math.abs(rowsToGo), cellsPerStep) * Math.sign(rowsToGo);
    var newCol = col + Math.min(Math.abs(colsToGo), cellsPerStep) * Math.sign(colsToGo);
    return [newRow, newCol];
}


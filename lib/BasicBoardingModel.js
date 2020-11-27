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
const urlPassengerStoring = "images/Superintendant_spawn.png";
const urlPassengerShuffling = "images/Superintendant_shuffle.png";

// A passenger enters the airplane QUEUEING to reach their seat row;
// Then STORING luggage; then proceed to SEATING then SEATED;
const WAITING = -1;
const QUEUEING = 0;
const STORING = 1;
const SEATING = 2;
const SHUFFLING = 3;
const SEATED = 4;

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
    { "name": "Total time taken: ", "location": { "row": 13, "col": 10 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Average boarding time: ", "location": { "row": 14, "col": 10 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Seat shuffles: ", "location": { "row": 15, "col": 10 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Stops for bag stowing: ", "location": { "row": 16, "col": 10 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Mean baggage store time: ", "location": { "row": 13, "col": 23 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Mean seat shuffle time: ", "location": { "row": 14, "col": 23 }, "cumulativeValue": 0, "count": 0 },
    { "name": "Simulation Run: ", "location": { "row": 16, "col": 23 }, "cumulativeValue": 0, "count": 0 },
];

var multiTotalBoardingTimeStatistic = [];
var multiAvgPassengerBoardingTimeStatistic1 = [];
var seatShuffleNumberStatistic = [];
var waitNumberStatistic = [];

var simulationNum = 0;

const EMPTY = -1;
const OCCUPIED = 1;

const TOPAREA = 0;
const BTMAREA = 1;

const NOTCALCULATED = -1;
const CALCULATED = 1;

// This next function is executed when the script is loaded. It contains the page initialization code.
(function () {
    // Your page initialization code goes here
    // All elements of the DOM will be available here
    window.addEventListener("resize", redrawWindow); //Redraw whenever the window is resized
    simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
    redrawWindow();
})();

function toggleSimStep() {
    //this function is called by a click event on the html page. 
    isRunning = !isRunning;
    console.log("isRunning: " + isRunning);
}

function initialiseVariables() {
    currentTime = 0;
    passengers = [];
    idCount = 1;

    statistics[0].cumulativeValue = 0;
    statistics[1].cumulativeValue = 0;
    statistics[2].cumulativeValue = 0;
    statistics[3].cumulativeValue = 0;
    statistics[0].count = 0;
    statistics[1].count = 0;
    statistics[2].count = 0;
    statistics[3].count = 0;

    statistics[4].cumulativeValue = (BAGGAGESTORELOWERLIMIT + BAGGAGESTOREUPPERLIMIT) / 2;
    statistics[5].cumulativeValue = SHUFFLETIME;
    statistics[6].cumulativeValue = 0;
    statistics[4].count = 0;
    statistics[5].count = 0;
    statistics[6].count = 0;

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
    seatMatrix = [];
    var seatID = 1;
    for (i = topSeatingArea.startRow; i < topSeatingArea.startRow + topSeatingArea.numRows; i++) {
        for (j = topSeatingArea.startCol; j < topSeatingArea.startCol + topSeatingArea.numCols; j++) {
            seatMatrix.push({ "location": { "row": i, "col": j, "area": TOPAREA }, "state": EMPTY, "seatID": seatID, "passengerID": -1 });
            seatID++;
        }
    }
    for (i = bottomSeatingArea.startRow; i < bottomSeatingArea.startRow + bottomSeatingArea.numRows; i++) {
        for (j = bottomSeatingArea.startCol; j < bottomSeatingArea.startCol + bottomSeatingArea.numCols; j++) {
            seatMatrix.push({ "location": { "row": i, "col": j, "area": BTMAREA }, "state": EMPTY, "seatID": seatID, "passengerID": -1 });
            seatID++
        }
    }
    // console.log(seatMatrix);
}

function assignSeats() {
    var numGroups = numRowSeats / 5
    var rowsPerside = numSeatsInRow / 2
    var numSeatsInGroups1_2 = Math.ceil(numRowSeats / 2)
    var numSeatsInGroups3_4 = Math.floor(numRowSeats / 2)
    unassignedPassengers = [];
    count = 0;
    for (i = 1; i <= numPassengers; i++) {
        unassignedPassengers.push(i);
    }
    switch (window.boardingmethod) {
        case "random":
            while (unassignedPassengers.length != 0) {
                var idx = Math.floor(Math.random() * unassignedPassengers.length);
                seatMatrix[count].passengerID = unassignedPassengers[idx];
                unassignedPassengers.splice(idx, 1);
                count++;
            }
            break;

        case "btf":
            while (unassignedPassengers.length != 0) {
                for (g = 1; g < numGroups + 1; g++) {
                    var delcount = 0
                    for (r = 0; r < 2 * rowsPerside; r++) {
                        for (count = r * numRowSeats + 5 * (numGroups - g); count < r * numRowSeats + 5 * (numGroups - g + 1); count++) {
                            var idx = Math.floor(Math.random() * (30 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                    }
                }
            }
            break;

        case "ftb":
            while (unassignedPassengers.length != 0) {
                for (g = 1; g < numGroups + 1; g++) {
                    var delcount = 0
                    for (r = 0; r < 2 * rowsPerside; r++) {
                        for (count = r * numRowSeats + 5 * (g - 1); count < r * numRowSeats + 5 * g; count++) {
                            var idx = Math.floor(Math.random() * (30 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                    }
                }
            }
            break;

        case "wta_random":
            while (unassignedPassengers.length != 0) {
                for (r = 0; r < rowsPerside; r++) {
                    var delcount = 0
                    for (count = r * numRowSeats; count < (r + 1) * numRowSeats; count++) {
                        var idx = Math.floor(Math.random() * (2 * numRowSeats - delcount));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount++;
                    }
                    delcount = 0
                    for (count = (5 - r) * numRowSeats; count < (6 - r) * numRowSeats; count++) {
                        var idx = Math.floor(Math.random() * (numRowSeats - delcount));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount++;
                    }
                }
            }
            break;

        case "wta_btf":
            while (unassignedPassengers.length != 0) {
                for (r = 0; r < rowsPerside; r++) {
                    for (g = 1; g < numGroups + 1; g++) {
                        var delcount = 0
                        for (count = r * numRowSeats + numRowSeats * ((numGroups - g) / numGroups); count < r * numRowSeats + numRowSeats - 5 * (g - 1); count++) {
                            var idx = Math.floor(Math.random() * (10 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                        delcount = 0
                        for (count = (5 - r) * numRowSeats + numRowSeats * ((numGroups - g) / numGroups); count < (6 - r) * numRowSeats - 5 * (g - 1); count++) {
                            var idx = Math.floor(Math.random() * (5 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                    }
                }
            }
            break;

        case "wta_ftb":
            while (unassignedPassengers.length != 0) {
                for (r = 0; r < rowsPerside; r++) {
                    for (g = 1; g < numGroups + 1; g++) {
                        var delcount = 0
                        for (count = r * numRowSeats + numRowSeats * ((g - 1) / numGroups); count < r * numRowSeats + 5 * g; count++) {
                            var idx = Math.floor(Math.random() * (10 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                        delcount = 0
                        for (count = (5 - r) * numRowSeats + numRowSeats * ((g - 1) / numGroups); count < (5 - r) * numRowSeats + 5 * g; count++) {
                            var idx = Math.floor(Math.random() * (5 - delcount));
                            seatMatrix[count].passengerID = unassignedPassengers[idx];
                            unassignedPassengers.splice(idx, 1);
                            delcount++;
                        }
                    }
                }
            }
            break;

        case "sm":
            steffenModifiedAssignSeats();
            break;

        case "sm_depracated":
            while (unassignedPassengers.length != 0) {
                var delcount = 0
                var delcount2 = 0
                var delcount3 = 0
                var delcount4 = 0
                //Group 1
                for (r = 0; r < numSeatsInRow - 3; r++) { // for rows 1 to 3 
                    for (count = (r + 1) * numRowSeats - 1; count >= r * numRowSeats; count = count - 2) { // for every odd column from 1 to 35
                        var idx = Math.floor(Math.random() * (numSeatsInGroups1_2 * rowsPerside - delcount));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount++;
                        //console.log(count)
                    }
                }
                //Group 2
                for (r = 3; r < numSeatsInRow; r++) { // for rows 4 to 6
                    for (count = (r + 1) * numRowSeats - 1; count >= r * numRowSeats; count = count - 2) { // for every odd column from 1 to 35
                        var idx = Math.floor(Math.random() * (numSeatsInGroups1_2 * rowsPerside - delcount2));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount2++;
                    }
                }
                //Group 3
                for (r = 0; r < numSeatsInRow - 3; r++) { // for rows 1 to 3 
                    for (count = (r + 1) * numRowSeats - 2; count >= r * numRowSeats + 1; count = count - 2) { // for every even column from 1 to 35
                        var idx = Math.floor(Math.random() * (numSeatsInGroups3_4 * rowsPerside - delcount3));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount3++;
                    }
                }
                //Group 4
                for (r = 3; r < numSeatsInRow; r++) { // for rows 4 to 6
                    for (count = (r + 1) * numRowSeats - 2; count >= r * numRowSeats + 1; count = count - 2) { // for every even column from 1 to 35
                        var idx = Math.floor(Math.random() * (numSeatsInGroups3_4 * rowsPerside - delcount4));
                        seatMatrix[count].passengerID = unassignedPassengers[idx];
                        unassignedPassengers.splice(idx, 1);
                        delcount4++;
                    }
                }
            }
            break;

        case "sp":
            grp_list = []
            var bot_row = numSeatsInRow
            var start_row = 1
            while (grp_list.length < 2 * numSeatsInRow) {
                grp_list.push(bot_row)
                if (bot_row != start_row && grp_list.includes(start_row) == false) {
                    grp_list.push(start_row)
                }
                grp_list.push(bot_row + 0.5)
                if (bot_row != start_row && grp_list.includes(start_row + 0.5) == false) {
                    grp_list.push(start_row + 0.5)
                }
                bot_row--
                start_row++
            }
            seat_assigned_order = []
            for (i of grp_list) {
                if (i % 1 == 0) {
                    var row_index = numRowSeats * i - 1
                    while (row_index >= numRowSeats * i - numRowSeats) {
                        seat_assigned_order.push(row_index)
                        row_index -= 2
                    }
                }
                else if (i % 1 == 0.5) {
                    var row_index = numRowSeats * Math.floor(i) - 2
                    while (row_index >= numRowSeats * Math.floor(i) - numRowSeats) {
                        seat_assigned_order.push(row_index)
                        row_index -= 2
                    }
                }
            }
            for (var i = 0; i < unassignedPassengers.length; i++) {
                seatMatrix[seat_assigned_order[i]].passengerID = unassignedPassengers[i];
            }
            break;
    }
}

// returns the location of seat assigned to passenger with passengerID
function getAssignedSeats(id) {
    for (seat of seatMatrix) {
        if (seat.passengerID == id) {
            return { "location": seat.location, "id": seat.seatID };
        }
    }
}

function redrawWindow() {
    isRunning = false; // used by simStep
    window.clearInterval(simTimer); // clear the Timer
    animationDelay = 550 - document.getElementById("slider1").value;
    simTimer = window.setInterval(simStep, animationDelay); // call the function simStep every animationDelay milliseconds
    window.boardingmethod = document.getElementById("bm").value;
    window.TOTALNUMSIMS = document.getElementById("number_runs").value;
    window.SHUFFLETIME = parseInt(document.getElementById("shufflingtime").value);
    window.BAGGAGESTORELOWERLIMIT = parseInt(document.getElementById("bagstoringtime").value) - 5;
    window.BAGGAGESTOREUPPERLIMIT = parseInt(document.getElementById("bagstoringtime").value) + 5;
    // Re-initialize simulation variables
    initialiseVariables();

    //resize the drawing surface; remove all its contents; 
    var drawsurface = document.getElementById("surface");
    var creditselement = document.getElementById("controls");
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
        .attr("xlink:href", function (d) {
            if (d.state == WAITING || d.state == QUEUEING) {
                return urlPassenger;
            } else if (d.state == STORING) {
                return urlPassengerStoring;
            } else if (d.state == SHUFFLING) {
                return urlPassengerShuffling;
            } else {
                return urlPassenger;
            }
        })
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
        var totalTimeTaken = d.cumulativeValue / Math.max(1, d.count);
        return d.name + totalTimeTaken.toFixed(1);
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
    if (idCount <= numPassengers && aisleList[queueStartCol] == EMPTY && counter % 4 == 0) {
        var assignedSeat = getAssignedSeats(idCount);
        var newPassenger = {
            "id": idCount, "location": { "row": aisleStartRow, "col": queueStartCol },
            "target": { "row": aisleStartRow, "col": assignedSeat.location.col },
            "seatID": assignedSeat.id,
            "assignedSeat": { "row": assignedSeat.location.row, "col": assignedSeat.location.col },
            "seatArea": assignedSeat.location.area,
            "state": QUEUEING,
            "boardPlaneTime": currentTime,
            "timeTakenToBoardPlane": -1,
            "baggageStoringTimeStart": -1,
            "baggageStoringTime": BAGGAGESTORELOWERLIMIT + Math.floor(Math.random() * Math.floor(BAGGAGESTOREUPPERLIMIT - BAGGAGESTORELOWERLIMIT)), // Uniform Distribution from 10-20
            "isSeatShuffleCalculated": NOTCALCULATED,
            "seatChecker": -1,
            "seatsToCheck": [],
            "seatShuffleTimeStart": -1,
            "seatShuffleTime": 0,
        };
        idCount++;
        passengers.push(newPassenger);
    }
}

function updateDynamicAgents() {
    // loop over all the agents and update their states
    for (var passengerIndex in passengers) {
        updatePassenger(passengerIndex);
    }
    updateSurface();
}

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
        statistics[0].cumulativeValue = currentTime;
        statistics[6].cumulativeValue = simulationNum + 1;

    } else if (simulationNum < TOTALNUMSIMS) {
        simulationNum++;
        console.log("Simulation #" + simulationNum + " completed");

        // Append statistics to array
        multiTotalBoardingTimeStatistic.push(statistics[0].cumulativeValue / Math.max(1, statistics[0].count));
        multiAvgPassengerBoardingTimeStatistic1.push(statistics[1].cumulativeValue / Math.max(1, statistics[1].count));
        seatShuffleNumberStatistic.push(statistics[2].cumulativeValue / Math.max(1, statistics[2].count));
        waitNumberStatistic.push(statistics[3].cumulativeValue / Math.max(1, statistics[3].count));

        if (simulationNum != TOTALNUMSIMS) {
            redrawWindow();
        }

        // Restart simulation
        isRunning = !isRunning;
    } if (simulationNum >= TOTALNUMSIMS) {
        isRunning = false;
        console.log("isRunning: " + isRunning);

        // Print statistics
        console.log("Total time taken to board Airplane: ");
        console.log(multiTotalBoardingTimeStatistic);

        console.log("Average time taken for passenger to board plane: ");
        console.log(multiAvgPassengerBoardingTimeStatistic1);

        console.log("Number of seat shuffles: ");
        console.log(seatShuffleNumberStatistic);


        console.log("Number of waits: ");
        console.log(waitNumberStatistic);

        // Reset Multiple Simulation Statistics
        multiTotalBoardingTimeStatistic = [];
        multiAvgPassengerBoardingTimeStatistic1 = [];
        seatShuffleNumberStatistic = [];
        waitNumberStatistic = [];

        simulationNum = 0;

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

    // Increase timeTakenToBoardPlane by 1 every simstep
    passenger.timeTakenToBoardPlane++;

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
                statistics[3].cumulativeValue++; // increase counter for no. of waits
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
            // if x amount of time has passed, change state to SEATING
            if (currentTime - passenger.baggageStoringTimeStart == passenger.baggageStoringTime) {
                passenger.state = SHUFFLING

            }

            break;

        case SHUFFLING:
            // if there is another passenger seated in the way of this passenger calculate passenger's seat shuffle time
            if (passenger.isSeatShuffleCalculated == NOTCALCULATED) {
                passenger.seatChecker = passenger.seatID;
                passenger.seatShuffleTimeStart = currentTime;

                if (passenger.seatArea == TOPAREA) {
                    while (passenger.seatChecker + numRowSeats <= numPassengers / 2) {
                        passenger.seatsToCheck.push(passenger.seatChecker + numRowSeats);
                        passenger.seatChecker += numRowSeats;
                    }
                } else if (passenger.seatArea == BTMAREA) { // passenger is seated at Bottom Area
                    while (passenger.seatChecker - numRowSeats > numPassengers / 2) {
                        passenger.seatsToCheck.push(passenger.seatChecker - numRowSeats);
                        passenger.seatChecker -= numRowSeats;
                    }
                }
                // calculate seat shuffle time
                for (seatID of passenger.seatsToCheck) {
                    if (seatMatrix[seatID - 1].state == OCCUPIED) {
                        // If passenger needs to seat shuffle
                        passenger.seatShuffleTime += SHUFFLETIME; // add shuffle time to passenger
                        statistics[2].cumulativeValue++; // increase seat shuffle statistic by 1
                    }
                }
                if (passenger.seatShuffleTime > 0) {
                    // Pause to simulate shuffle time
                }
                passenger.isSeatShuffleCalculated = CALCULATED;
            }

            // wait for x amount of time for seatShuffleTime
            if (currentTime - passenger.seatShuffleTimeStart >= passenger.seatShuffleTime) {
                // then
                passenger.state = SEATING;
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
                // Update seatMatrix to reflect that seat is OCCUPIED
                seatMatrix[passenger.seatID - 1].state = OCCUPIED
                // Used to calculate average boarding times
                passenger.timeTakenToBoardPlane = currentTime - passenger.boardPlaneTime;
                statistics[1].cumulativeValue += passenger.timeTakenToBoardPlane;
                statistics[1].count++;
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

function resetSimulation() {
    redrawWindow();
    multiTotalBoardingTimeStatistic = [];
    multiAvgPassengerBoardingTimeStatistic1 = [];
    seatShuffleNumberStatistic = [];
    waitNumberStatistic = [];

    simulationNum = 0;

    // Code to start the simulation immediately after reseting
    // isRunning = true;
}

function steffenModifiedAssignSeats() {
    // Group 1
    seatMatrix[34].passengerID = 1
    seatMatrix[69].passengerID = 2
    seatMatrix[32].passengerID = 3
    seatMatrix[104].passengerID = 4
    seatMatrix[67].passengerID = 5
    seatMatrix[30].passengerID = 6
    seatMatrix[102].passengerID = 7
    seatMatrix[65].passengerID = 8
    seatMatrix[28].passengerID = 9
    seatMatrix[100].passengerID = 10
    seatMatrix[63].passengerID = 11
    seatMatrix[26].passengerID = 12
    seatMatrix[98].passengerID = 13
    seatMatrix[61].passengerID = 14
    seatMatrix[24].passengerID = 15
    seatMatrix[96].passengerID = 16
    seatMatrix[59].passengerID = 17
    seatMatrix[22].passengerID = 18
    seatMatrix[94].passengerID = 19
    seatMatrix[57].passengerID = 20
    seatMatrix[20].passengerID = 21
    seatMatrix[92].passengerID = 22
    seatMatrix[55].passengerID = 23
    seatMatrix[18].passengerID = 24
    seatMatrix[90].passengerID = 25
    seatMatrix[53].passengerID = 26
    seatMatrix[16].passengerID = 27
    seatMatrix[88].passengerID = 28
    seatMatrix[51].passengerID = 29
    seatMatrix[14].passengerID = 30
    seatMatrix[86].passengerID = 31
    seatMatrix[49].passengerID = 32
    seatMatrix[12].passengerID = 33
    seatMatrix[84].passengerID = 34
    seatMatrix[47].passengerID = 35
    seatMatrix[10].passengerID = 36
    seatMatrix[82].passengerID = 37
    seatMatrix[45].passengerID = 38
    seatMatrix[8].passengerID = 39
    seatMatrix[80].passengerID = 40
    seatMatrix[43].passengerID = 41
    seatMatrix[6].passengerID = 42
    seatMatrix[78].passengerID = 43
    seatMatrix[41].passengerID = 44
    seatMatrix[4].passengerID = 45
    seatMatrix[76].passengerID = 46
    seatMatrix[39].passengerID = 47
    seatMatrix[2].passengerID = 48
    seatMatrix[74].passengerID = 49
    seatMatrix[37].passengerID = 50
    seatMatrix[0].passengerID = 51
    seatMatrix[72].passengerID = 52
    seatMatrix[35].passengerID = 53
    seatMatrix[70].passengerID = 54

    // Group 2
    seatMatrix[209].passengerID = 55
    seatMatrix[174].passengerID = 56
    seatMatrix[207].passengerID = 57
    seatMatrix[139].passengerID = 58
    seatMatrix[172].passengerID = 59
    seatMatrix[205].passengerID = 60
    seatMatrix[137].passengerID = 61
    seatMatrix[170].passengerID = 62
    seatMatrix[203].passengerID = 63
    seatMatrix[135].passengerID = 64
    seatMatrix[168].passengerID = 65
    seatMatrix[201].passengerID = 66
    seatMatrix[133].passengerID = 67
    seatMatrix[166].passengerID = 68
    seatMatrix[199].passengerID = 69
    seatMatrix[131].passengerID = 70
    seatMatrix[164].passengerID = 71
    seatMatrix[197].passengerID = 72
    seatMatrix[129].passengerID = 73
    seatMatrix[162].passengerID = 74
    seatMatrix[195].passengerID = 75
    seatMatrix[127].passengerID = 76
    seatMatrix[160].passengerID = 77
    seatMatrix[193].passengerID = 78
    seatMatrix[125].passengerID = 79
    seatMatrix[158].passengerID = 80
    seatMatrix[191].passengerID = 81
    seatMatrix[123].passengerID = 82
    seatMatrix[156].passengerID = 83
    seatMatrix[189].passengerID = 84
    seatMatrix[121].passengerID = 85
    seatMatrix[154].passengerID = 86
    seatMatrix[187].passengerID = 87
    seatMatrix[119].passengerID = 88
    seatMatrix[152].passengerID = 89
    seatMatrix[185].passengerID = 90
    seatMatrix[117].passengerID = 91
    seatMatrix[150].passengerID = 92
    seatMatrix[183].passengerID = 93
    seatMatrix[115].passengerID = 94
    seatMatrix[148].passengerID = 95
    seatMatrix[181].passengerID = 96
    seatMatrix[113].passengerID = 97
    seatMatrix[146].passengerID = 98
    seatMatrix[179].passengerID = 99
    seatMatrix[111].passengerID = 100
    seatMatrix[144].passengerID = 101
    seatMatrix[177].passengerID = 102
    seatMatrix[109].passengerID = 103
    seatMatrix[142].passengerID = 104
    seatMatrix[175].passengerID = 105
    seatMatrix[107].passengerID = 106
    seatMatrix[140].passengerID = 107
    seatMatrix[105].passengerID = 108

    // Group 3
    seatMatrix[33].passengerID = 109
    seatMatrix[68].passengerID = 110
    seatMatrix[31].passengerID = 111
    seatMatrix[103].passengerID = 112
    seatMatrix[66].passengerID = 113
    seatMatrix[29].passengerID = 114
    seatMatrix[101].passengerID = 115
    seatMatrix[64].passengerID = 116
    seatMatrix[27].passengerID = 117
    seatMatrix[99].passengerID = 118
    seatMatrix[62].passengerID = 119
    seatMatrix[25].passengerID = 120
    seatMatrix[97].passengerID = 121
    seatMatrix[60].passengerID = 122
    seatMatrix[23].passengerID = 123
    seatMatrix[95].passengerID = 124
    seatMatrix[58].passengerID = 125
    seatMatrix[21].passengerID = 126
    seatMatrix[93].passengerID = 127
    seatMatrix[56].passengerID = 128
    seatMatrix[19].passengerID = 129
    seatMatrix[91].passengerID = 130
    seatMatrix[54].passengerID = 131
    seatMatrix[17].passengerID = 132
    seatMatrix[89].passengerID = 133
    seatMatrix[52].passengerID = 134
    seatMatrix[15].passengerID = 135
    seatMatrix[87].passengerID = 136
    seatMatrix[50].passengerID = 137
    seatMatrix[13].passengerID = 138
    seatMatrix[85].passengerID = 139
    seatMatrix[48].passengerID = 140
    seatMatrix[11].passengerID = 141
    seatMatrix[83].passengerID = 142
    seatMatrix[46].passengerID = 143
    seatMatrix[9].passengerID = 144
    seatMatrix[81].passengerID = 145
    seatMatrix[44].passengerID = 146
    seatMatrix[7].passengerID = 147
    seatMatrix[79].passengerID = 148
    seatMatrix[42].passengerID = 149
    seatMatrix[5].passengerID = 150
    seatMatrix[77].passengerID = 151
    seatMatrix[40].passengerID = 152
    seatMatrix[3].passengerID = 153
    seatMatrix[75].passengerID = 154
    seatMatrix[38].passengerID = 155
    seatMatrix[1].passengerID = 156
    seatMatrix[73].passengerID = 157
    seatMatrix[36].passengerID = 158
    seatMatrix[71].passengerID = 159


    // Group 4
    seatMatrix[208].passengerID = 160
    seatMatrix[173].passengerID = 161
    seatMatrix[206].passengerID = 162
    seatMatrix[138].passengerID = 163
    seatMatrix[171].passengerID = 164
    seatMatrix[204].passengerID = 165
    seatMatrix[136].passengerID = 166
    seatMatrix[169].passengerID = 167
    seatMatrix[202].passengerID = 168
    seatMatrix[134].passengerID = 169
    seatMatrix[167].passengerID = 170
    seatMatrix[200].passengerID = 171
    seatMatrix[132].passengerID = 172
    seatMatrix[165].passengerID = 173
    seatMatrix[198].passengerID = 174
    seatMatrix[130].passengerID = 175
    seatMatrix[163].passengerID = 176
    seatMatrix[196].passengerID = 177
    seatMatrix[128].passengerID = 178
    seatMatrix[161].passengerID = 179
    seatMatrix[194].passengerID = 180
    seatMatrix[126].passengerID = 181
    seatMatrix[159].passengerID = 182
    seatMatrix[192].passengerID = 183
    seatMatrix[124].passengerID = 184
    seatMatrix[157].passengerID = 185
    seatMatrix[190].passengerID = 186
    seatMatrix[122].passengerID = 187
    seatMatrix[155].passengerID = 188
    seatMatrix[188].passengerID = 189
    seatMatrix[120].passengerID = 190
    seatMatrix[153].passengerID = 191
    seatMatrix[186].passengerID = 192
    seatMatrix[118].passengerID = 193
    seatMatrix[151].passengerID = 194
    seatMatrix[184].passengerID = 195
    seatMatrix[116].passengerID = 196
    seatMatrix[149].passengerID = 197
    seatMatrix[182].passengerID = 198
    seatMatrix[114].passengerID = 199
    seatMatrix[147].passengerID = 200
    seatMatrix[180].passengerID = 201
    seatMatrix[112].passengerID = 202
    seatMatrix[145].passengerID = 203
    seatMatrix[178].passengerID = 204
    seatMatrix[110].passengerID = 205
    seatMatrix[143].passengerID = 206
    seatMatrix[176].passengerID = 207
    seatMatrix[108].passengerID = 208
    seatMatrix[141].passengerID = 209
    seatMatrix[106].passengerID = 210
}
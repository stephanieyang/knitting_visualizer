/* CHART_PREVIEW_MODE is true if viewing the chart as an output of code input,
 * false if editing the chart as an input for code output.
 */
var CHART_PREVIEW_MODE = true;


var currentPaletteColor = "white";

/* Re-add listeners for the editable chart. */
function setUpChartEdit() {
    $("#chartTable td").click(function(event) {
        if(!CHART_PREVIEW_MODE) {
            // if the user presses CTRL (Windows) or the command button (Mac), change color to the one in the palette
            // (note: this also allows it when the Windows key is pressed on Windows computers, but that's not a huge concern here)
            var colorEditMode = event.ctrlKey || event.metaKeyCode;
            var stitchId = $(this).attr('id');
            modifyChartStitch(stitchId, colorEditMode);

        } else {
            console.log('clicked in preview mode');
        }
    });
}


/* Toggles between View/Edit mode on Chart mode. */
function toggleChartPreviewMode() {
    CHART_PREVIEW_MODE = !CHART_PREVIEW_MODE;
    if(CHART_PREVIEW_MODE) {
        $("#chartModeBtn").html("Go to Edit Mode");
        $("#numRowsInput").attr("disabled", true);
        $("#stitchesPerRowInput").attr("disabled", true);
    } else {
        $("#chartModeBtn").html("Go to View Mode");
        $("#numRowsInput").attr("disabled", false);
        $("#stitchesPerRowInput").attr("disabled", false);
    }

    if(CHART_VIEW) {
        // We just now created this table, so add a listener for Chart Edit Mode
        setUpChartEdit();

    }
}

/*
 * Modifies the visible stitch in the output table and in the pattern in memory.
 * stitchId = id of the table cell that represents the stitch, e.g., 3-5
 * modifyColor = true iff changing the cell color on CTRL/meta + click, false (toggling knit/purl) otherwise
 */
function modifyChartStitch(stitchId, modifyColor) {
    if(CHART_PREVIEW_MODE) return;
    var chartRow = stitchId.split("-")[0];
    var chartCol = stitchId.split("-")[1];
    var stitchIndex;
    var stitchCell = $("#" + stitchId);
    if(isOdd(chartRow)) { // if WS row, need to get the right stitch index in the pattern list
        stitchIndex = STITCHES_PER_ROW - chartCol - 1;
    } else {
        stitchIndex = chartCol;
    }
    var listStitch = currentPatternList[chartRow][stitchIndex];
    if(modifyColor) {
        var colorToSet = $("#colorTableCurrent").attr('class'); // color from a set palette
        // don't add anything if the palette color hasn't been chosen
        if(colorToSet == "gray") return;
        // clear the current class
        stitchCell.removeClass(stitchCell.attr('class'));
        // set the new color
        stitchCell.addClass(colorToSet);
        listStitch.color = colorToSet;
    } else {
        // toggle knit/purl symbols
        console.log("currently: " + ((stitchCell.html() == KNIT_CONTENTS) ? "knit" : "purl"));
        if(stitchCell.html() == KNIT_CONTENTS) {   // knit stitch -> purl stitch
            stitchCell.html(PURL_CONTENTS);
        } else {                                // purl stitch -> knit stitch
            stitchCell.html(KNIT_CONTENTS);
        }

        listStitch.isPurl = !listStitch.isPurl;
    }

}

$(document).ready(function() {
    $("#runCodeBtn").click(function() {
        if(!CHART_PREVIEW_MODE) {
            setUpChartEdit();
        }
    });

    $("#chartModeBtn").click(function() {
        toggleChartPreviewMode();
    });

    $("#colorTable td.color").click(function() {
        var colorId = $(this).attr('id');
        var color = colorId.split("-")[1]; // e.g., "color-red"-> "red"
        $("#colorTableCurrent").removeClass(currentPaletteColor);
        $("#colorTableCurrent").addClass(color);
        currentPaletteColor = color;

    });

    $("#resizeChartBtn").click(function() {
        console.log("resize clicked");
        resizeChart();
    });

    $("#generateCodeBtn").click(function() {

        // (in case the user edits them but doesn't resize)
        $("#numRowsInput").val(currentPatternList.length); // number of rows
        $("#stitchesPerRowInput").val(currentPatternList[0].length); // number of stitches per row (cols per row)
        generateCode();
    });


});

function getFuncCallText(funcName, param, paramIsStringValue) {
    var valueWrapper =  (paramIsStringValue ? "\"" : "");
    return (funcName + "(" + valueWrapper + param + valueWrapper + ");" + TEXTAREA_NEWLINE);
}

function generateCode() {
    console.log("Generating code...");
    var currentColor = currentPatternList[0][0].color;
    var isPurlStitch = currentPatternList[0][0].isPurl;
    // initial info
    var codeText = getFuncCallText("setStitchesPerRow", STITCHES_PER_ROW, false);
    codeText += getFuncCallText("setColor", currentColor, true);

    /*
     * POSSIBLE CHANGE SCENARIOS AND SAMPLE OUTPUT:
     *     change color and stitch at the same time => knit(2); setColor("blue"); purl(2); 
     *     change color, but not stitch => knit(2); setColor("blue"); knit(2);
     *     change stitch only -> knit(2); purl(2);
     */

    for(var i = 0; i < currentPatternList.length; i++) {
        var stitchCounter = 0;
        codeText += "// Row " + (i+1) + TEXTAREA_NEWLINE;
        //console.log("*** ROW " + (i+1) + " ***");
        isPurlStitch = currentPatternList[i][0].isPurl;
        if(currentPatternList[i][0].color != currentColor) {
            currentColor = currentPatternList[i][0].color;
            codeText += getFuncCallText("setColor", currentColor, true);
        }
        for(var j = 0; j < STITCHES_PER_ROW; j++) {
            var currentStitch = currentPatternList[i][j];
            if(currentStitch.color != currentColor) {
                // 
                codeText += getFuncCallText((isPurlStitch ? "purl" : "knit"), stitchCounter, false);
                codeText += getFuncCallText("setColor", currentStitch.color, true);
                currentColor = currentStitch.color;
                isPurlStitch = currentStitch.isPurl; // might stay the same, might change; either way this becomes a starting point
                stitchCounter = 1;
            } else if(currentStitch.isPurl != isPurlStitch) {
                // add function call for previous run of stitches
                codeText += getFuncCallText((isPurlStitch ? "purl" : "knit"), stitchCounter, false);
                stitchCounter = 1;
                isPurlStitch = currentStitch.isPurl;
            } else {
                stitchCounter++;
            }
        }
        if(stitchCounter == STITCHES_PER_ROW) {
            codeText += getFuncCallText((isPurlStitch ? "purlRow" : "knitRow"), "", false);
        } else {
            codeText += getFuncCallText((isPurlStitch ? "purl" : "knit"), stitchCounter, false);
        }
    }

    $("#codeText").val(codeText);
    console.log("done generating code, text = " + codeText);
}

function getNewFillerStitch() {
    return (new Stitch(false, "white"));
}

function resizeChart() {
    if(!CHART_VIEW || CHART_PREVIEW_MODE) {
        showError("Can't resize: are you in Chart View or Chart Edit mode?");
        // TODO: more helpful error message?
        return;
    }

    var currentNumberRows = currentPatternList.length;
    var currentStitchesPerRow = STITCHES_PER_ROW;
    var newNumberRows = parseInt($("#numRowsInput").val());
    var newStitchesPerRow = parseInt($("#stitchesPerRowInput").val());

    if(newStitchesPerRow <= 0 || newNumberRows <= 0) {
        showError("Invalid input");
        // TODO: decimal input?
    }

    var horizontalDiff = newStitchesPerRow - STITCHES_PER_ROW;
    var verticalDiff = newNumberRows - currentNumberRows;

    // if no dimensions have been modified, skip all proceeding steps
    if((horizontalDiff == 0) && (verticalDiff == 0)) {
        console.log("no difference");
        return;
    }

    var chartTable = $("#chartTable tbody");
    // modify the in-memory chart

    if(horizontalDiff > 0) {
        // need to increase the width => "grow" new stitches on each row from the left (since we go right->left on the RS)
        // here we initialize new stitches as white knit stitches
        for(var i = 0; i < currentNumberRows; i++) {
            for(var j = currentStitchesPerRow; j < newStitchesPerRow; j++) {
                if(isOdd(i)) {
                    currentPatternList[i].unshift(getNewFillerStitch()); // prepend stitches (L -> R)

                } else {
                    currentPatternList[i].push(getNewFillerStitch()); // append stitches (L <- R)
                }
                
            }
        }

    } else if(horizontalDiff < 0) {
        // need to decrease the width => remove extra stitches on each row from the left
        for(var i = 0; i < currentNumberRows; i++) {
            //for(var j = 0; j < newStitchesPerRow; j++) { console.log(j); }
            console.log(newNumberRows);
            console.log(newStitchesPerRow);
            if(isOdd(i)) {
                currentPatternList[i] = currentPatternList[i].slice(Math.abs(horizontalDiff)); // slice stitches L -> R
            } else {
                console.log("row =");
                console.log(currentPatternList[i]);
                currentPatternList[i] = currentPatternList[i].slice(0, newStitchesPerRow); // slice stitches L <- R
            }

            
        }

        
    } // third case (=) => do nothing
    STITCHES_PER_ROW = newStitchesPerRow;
    if(verticalDiff > 0) {
        // need to increase the height => add new rows onto the end (vertical top)
        for(var i = currentNumberRows; i < newNumberRows; i++) {
            var newPatternRow = [];
            for(var j = 0; j < STITCHES_PER_ROW; j++) {
                newPatternRow.push(getNewFillerStitch());
            }
            currentPatternList.push(newPatternRow);
        }

    } else if(verticalDiff < 0) {
        // need to decrease the height => remove extra rows at the end (vertical top)
        currentPatternList = currentPatternList.slice(0, newNumberRows);

    } // third case (=) => do nothing

    console.log("done in resize, setting up listeners...");
    var pattern = new Pattern(newNumberRows, newStitchesPerRow, currentPatternList);
    displayPattern(pattern, CHART_VIEW);
    setUpChartEdit();
}
var margin = {
  top: 60,
  right: 10,
  bottom: 10,
  left: 60
};
var size = 1600;
var width = size - 10 - margin.right;
var height = size - 10 - margin.bottom;
	
//SVG container
var svg = d3.select('#bookChart')
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom)
	.on("mouseover", function(d) { 
		clearTimeout(highlightBookTimer);
	})
	.on("mouseout", mouseOutAll);

var g = svg.append("g").attr("class", "top-wrapper")
	.attr("transform", "translate(" + (margin.left) + "," + (margin.top) + ")")
	.style("isolation", "isolate");	

//SVG container 2
var svgb = d3.select('#lineChart')
	.append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.top + margin.bottom);

var gb = svgb.append("g").attr("class", "top-wrapper-lines")
	.attr("transform", "translate(" + (margin.left) + "," + (margin.top) + ")")
	.style("isolation", "isolate");		

// svg.call(d3.zoom()
//     .scaleExtent([0.5, 10])
//     .on("zoom", zoomed));

// function zoomed() {
//   g.attr("transform", d3.event.transform);
// }

///////////////////////////////////////////////////////////////////////////
//////////////////////////// Create the filter ////////////////////////////
///////////////////////////////////////////////////////////////////////////

//Container for the gradients
var defs = svg.append("defs");

//Filter for the outside glow
defs.append("filter")
	.attr("id", "blur")
	.attr("height", "300%")	
	.attr("width", "300%")	//increase the width of the filter region to remove blur "boundary"
	.attr("x", "-100%")
	.attr("y", "-100%")
	.append("feGaussianBlur")
	.attr("stdDeviation", 40);

///////////////////////////////////////////////////////////////////////////
///////////////// Adjust a few things of the inline SVGs //////////////////
///////////////////////////////////////////////////////////////////////////

d3.select("#term-areas").selectAll("ellipse")
	//.style("mix-blend-mode", "multiply")
	.style("opacity", 0.4)
	.style("filter", "url(#blur)");

///////////////////////////////////////////////////////////////////////////
////////////////////////// Create the scales //////////////////////////////
///////////////////////////////////////////////////////////////////////////

//Position scale
var posScale = d3.scaleLinear()
	.domain([-50,50])
	.range([0,size]);

//Book circle scale
var rScale = d3.scaleSqrt()
	.range([2,30]);	
//Book title font scale
var fontTitleScale = d3.scaleSqrt()
	.range([6,40]);

//Connecting path thickness scale
var rankScale = d3.scaleLinear()
	.domain([1,20,50,75,100])
	.range([6,2,0.8,0.5,0.3]);

//Favorite authors/book colors
var favColors = ["#00c176","#FABE28","#FF003C","#FF8A00","#34ceed"];
//Brandon Sanderson, Patrick Rothfuss, J.K. Rowling, Brent Weeks, Terry Goodkind
var favColorScale = d3.scaleOrdinal()
	.domain([7,30,1,15,61])
	.range(favColors)
	.unknown("white");
var favStrokecale = d3.scaleOrdinal()
	.domain([7,30,1,15,61])
	.range(favColors)
	.unknown("#f2f2f2");

//Angle scale for the letter
var alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
var angleScale = d3.scaleOrdinal()
	.domain(alphabet)
	.range(d3.range(-0.5*Math.PI,1.5*Math.PI, 2*Math.PI/26));
//Scale of the mini circles around the bigger ones
var rMiniScale = d3.scaleSqrt()
	.domain(rScale.range())
	.range([0.2,1.75]);	
	
///////////////////////////////////////////////////////////////////////////
//////////////////////////// Read in the data /////////////////////////////
///////////////////////////////////////////////////////////////////////////

var highlightBookTimer;

d3.queue() 
  .defer(d3.csv, "../../data/nadieh/topAuthorBooksLocationsUpdated.csv")
  .await(draw);
  	
function draw(error, books) {

	///////////////////////////////////////////////////////////////////////////
	///////////////////////////// Final data prep /////////////////////////////
	///////////////////////////////////////////////////////////////////////////
	
	if (error) throw error;
	
	books.forEach(function(d) {
		d.id = +d.id;
		d.authorRank = +d.authorRank;
		d.x = +d.x;
		d.y = +d.y;
		d.num_ratings = +d.num_ratings;
		d.favBook = +d.favBook;
		d.favAuthor = +d.favAuthor;
		d.pathOrder = +d.pathOrder;
	});//forEach
	
	//Nest the books per author
	var booksAuthor = d3.nest()
		.key(function(d) { return d.authorRank; })
		.entries(books);

	rScale.domain(d3.extent(books, function(d) { return d.num_ratings; }));
	fontTitleScale.domain(d3.extent(books, function(d) { return d.num_ratings; }));
	
	///////////////////////////////////////////////////////////////////////////
	///////////// Plot the lines between books of the same author /////////////
	///////////////////////////////////////////////////////////////////////////
		
	//Set up the path between the books of the same author
	function curvedLine(data) {
		//A path is only needed if there are > 1 books
		if(data.length > 1) {
			//Sort the books in the right connection order, to get the smallest path possible
			//which was precalculated in R using the Traveling Salesman approach
			data.sort(function(a,b) { return a.pathOrder - b.pathOrder; });

			var path = "M";
			//Loop over the locations of all books of the author
			for(var i=0; i<(data.length-1); i++) {
				var x1 = round2(posScale(data[i].x)),
					y1 = round2(posScale(data[i].y)),
					x2 = round2(posScale(data[i+1].x)),
					y2 = round2(posScale(data[i+1].y)),
					dx = x1 - x2,
					dy = y1 - y2;
				var curve = round2(Math.sqrt(dx*dx + dy*dy) * 1);
			
				//On the first run, randomly decide which direction the sweepflag should be and keep that one
				if(!data[i].sweepFlag) data[i].sweepFlag = (Math.random() > 0.5 ? 1 : 0);
				
				//Add the new arc information to the path
				path = path + x1 + " " + y1 + " A" + curve + " " + curve + " 0 0 " + data[i].sweepFlag + " ";
			}//for i
			//End the path
			path = path + x2 + " " + y2;

			return path;
		}//if
	}//function curvedLine

	var pathGroup = gb.append("g").attr("class", "path-wrapper");
	
	//Draw the paths between the books of the same author
	var authorPaths = pathGroup.selectAll(".author-path")
		.data(booksAuthor, function(d) { return d.values[0].id; })
		.enter().append("path")
		.attr("class","author-path")
		.attr("d", function(d) { return curvedLine(d.values); })
		.style("stroke", function(d) { return favStrokecale(d.values[0].authorRank); })
		.style("stroke-width", function(d) { return rankScale(d.values[0].authorRank); })
		.style("opacity", function(d) { return d.values[0].favAuthor === 1 ? 0.9 : 0.4; });

	///////////////////////////////////////////////////////////////////////////
	////////////////////////////// Plot the books /////////////////////////////
	///////////////////////////////////////////////////////////////////////////
						
	var bookGroup = g.append("g").attr("class","book-wrapper");
	var hoverColor = "#260f4c";

	var bookElements = bookGroup.selectAll(".book")
		.data(books.sort(function(a,b) { return a.favAuthor - b.favAuthor || b.num_ratings - a.num_ratings; }), function(d) { return d.id; })
		.enter().append("g")
		.attr("class","book")
		.attr("transform", function(d) { return "translate(" + posScale(d.x) + "," + posScale(d.y) + ")"; })
		.on("mouseover", function(d) { 

			//Clear any timer that might still be running
			clearTimeout(highlightBookTimer);
			//Don't let it bubble upwards to the SVG element
			d3.event.stopPropagation();

			//Add hover with author name
			var mouseEvent = d3.event;

			//Hover over the title for at least X milliseconds to start this event
			//Otherwise you get flashing
			highlightBookTimer = setTimeout( function() {

				//Move the tooltip to the right location
		      	tooltipName.text(d.author);
		      	tooltipRank.text("Rank in top 100: " + d.authorRank);
		      	tooltipWrapper
		        	.attr("transform", "translate(" + posScale(d.x) + "," + (posScale(d.y) + 30) + ")")
		        	.style("opacity", 1);

				//Find the other books and highlight those as well
				var allAuthorBooks = bookElements.filter(function(b) { return b.authorRank === d.authorRank; });
				
				allAuthorBooks.selectAll(".book-circle, .letter-circle")
					.style("fill", hoverColor);
				allAuthorBooks.selectAll(".letter-path")
					.style("stroke", hoverColor);

				authorPaths.filter(function(b) { return +b.key === d.authorRank; })
					.style("stroke", hoverColor)
					.style("opacity", 1);	

			}, 500);
		})
		.on("mouseout", function(d) {

			clearTimeout(highlightBookTimer);

			//Hide the tooltip
		    tooltipWrapper.style("opacity", 0);

			//Turn the visual back to normal
			var allAuthorBooks = bookElements.filter(function(b) { return b.authorRank === d.authorRank; });
			allAuthorBooks.selectAll(".book-circle, .letter-circle")
				.style("fill", function(b) { return b.favBook === 1 ? favColorScale(b.authorRank) : favColorScale.unknown(); });
			allAuthorBooks.selectAll(".letter-path")
				.style("stroke", function(b) { return b.favBook === 1 ? favColorScale(b.authorRank) : favColorScale.unknown(); });

			authorPaths.filter(function(b) { return +b.key === d.authorRank; })
				.style("stroke", function(b) { return favStrokecale(b.values[0].authorRank); })
				.style("opacity", function(b) { return b.values[0].favAuthor === 1 ? 0.9 : 0.4; });

		});
	
	//Circle	
	var bookCircle = bookElements.append("circle")
		.attr("class", "book-circle")
		.attr("r", function(d) { return rScale(d.num_ratings); })
		.style("fill", function(d) { return d.favBook === 1 ? favColorScale(d.authorRank) : favColorScale.unknown(); })
		.style("stroke", function(d) { return d.favBook === 0 && d.favAuthor == 1 ? favColorScale(d.authorRank) : "none"; });
		//.style("opacity", 1);
		
	//Elaborate figure for book title
	bookElements.append("g")
		.each(function(d) {
			var el = d3.select(this);

			var radiusCircle = rMiniScale(rScale(d.num_ratings));

			//Array that keeps count of how often a letter has passed
			var letterCount = new Array(26);
			for(var j=0; j<letterCount.length; j++) {
				letterCount[alphabet[j]] = 0
			}//for j

			//Turn to lowercase
			var title = d.title.toLocaleLowerCase();

			//Split the title up into words 
			var words = title.split(" ");
			for(var j=0; j<words.length; j++){

				//Only keep a-z characters
				var word = words[j].replace(/[^a-z]/gi, '');

				//Split the word into letters
				var letters = word.split("");

				//Array to save the positions of the letters in
				var letterLoc = [];
				for (var i = 0; i < letters.length; i++)
				    letterLoc.push({});

				//Loop over all letters and draw a small circle around the book circle
				for(var k=0; k<letters.length; k++) {
					//Add the letter to the alphabet counter
					letterCount[letters[k]] += 1;

					//Save positions in array to use later
					letterLoc[k].x = (rScale(d.num_ratings) + 2.75 * radiusCircle * letterCount[letters[k]] - 0.75 * radiusCircle) * Math.cos(angleScale(letters[k]));
					letterLoc[k].y = (rScale(d.num_ratings) + 2.75 * radiusCircle * letterCount[letters[k]] - 0.75 * radiusCircle) * Math.sin(angleScale(letters[k]));

					//Draw the circle
					el.append("circle")
						.attr("class", "letter-circle")
						.attr("cx", letterLoc[k].x)
						.attr("cy", letterLoc[k].y)
						.attr("r", radiusCircle )
						.style("fill", d.favBook === 1 ? favColorScale(d.authorRank) : favColorScale.unknown() );
				}//for k

				//Draw a line between all the letters in the word
				if(letters.length > 1) {
					var path = "M"
					for(var k=0; k<(letters.length-1); k++) {
						//Somewhat round the numbers, so Illustrator can handle it
						var x1 = round2(letterLoc[k].x),
							y1 = round2(letterLoc[k].y),
							x2 = round2(letterLoc[k+1].x),
							y2 = round2(letterLoc[k+1].y),
							dx = x1 - x2,
							dy = y1 - y2;

						var curve = round2(Math.sqrt(dx*dx + dy*dy) * 0.55);

						//Get the angles to determine the optimum sweepflag
						var a1 = angleScale(letters[k]),
							a2 = angleScale(letters[k+1]);
						var da = (a2-a1)/Math.PI;
					
						var sweepFlag = 1;
						//if( (da > -3/2 && da <= -1) || (da > -1/2 && da <= 0) || (da > 1/2 && da <= 1) || (da > 3/2 && da <= 2) ) {
						if( (da > -1 && da <= 0) || (da > 1 && da <= 2) ) {
							sweepFlag = 0;
						}//if
						
						//Add the new arced section to the path
						path = path + x1 + " " + y1 + " A" + curve + " " + curve + " 0 1 " + sweepFlag + " ";
					}//for i
					//Complete the path
					path = path + x2 + " " + y2;

					//Draw the word path
					el.append("path")
						.attr("class","letter-path")
						.attr("d", path)
						.style("stroke", d.favBook === 1 ? favColorScale(d.authorRank) : favColorScale.unknown() )
						.style("stroke-width", Math.max(0.3, radiusCircle * 0.5) )
						.style("opacity", 0.9);
				}//if

			}//for j
		})//each
	

	///////////////////////////////////////////////////////////////////////////
	////////////////////////// Place the book titles //////////////////////////
	///////////////////////////////////////////////////////////////////////////
		
	//Place titles above the book circles
	var bookTitles = bookElements.append("text")
		.attr("class","book-title")
		.each(function(d) {
			if(!d.titleX) { d.titleX = 0; }
			if(!d.titleY) { d.titleY = -(rScale(d.num_ratings)*1.4); }
		})
		.attr("y", function(d) { return d.titleY; })
		.style("font-size", function(d) { return fontTitleScale(d.num_ratings) + "px"; })
		.text(function(d) { return d.title; });

	///////////////////////////////////////////////////////////////////////////
	////////////////////////////// Add Tooltip ////////////////////////////////
	///////////////////////////////////////////////////////////////////////////

	var tooltipWrapper = g.append("g")
	  .attr("class", "tooltip-wrapper")
	  .attr("transform", "translate(" + 0 + "," + 0 + ")")
	  .style("fill", hoverColor)
	  .style("opacity", 0);

	var tooltipName = tooltipWrapper.append("text")
	  .attr("class", "tooltip-name")
	  .text("");

	var tooltipRank = tooltipWrapper.append("text")
	  .attr("class", "tooltip-rank")
	  .attr("y", 17)
	  .text("");

}//draw

///////////////////////////////////////////////////////////////////////////
/////////////////////////// Mouse functions ///////////////////////////////
///////////////////////////////////////////////////////////////////////////

function mouseOutAll(d) {
	//Turn the visual back to normal
	d3.selectAll(".book-circle, .letter-circle")
		.style("fill", function(b) { return b.favBook === 1 ? favColorScale(b.authorRank) : favColorScale.unknown(); });
	d3.selectAll(".letter-path")
		.style("stroke", function(b) { return b.favBook === 1 ? favColorScale(b.authorRank) : favColorScale.unknown(); });

	d3.selectAll(".author-path")
		.style("stroke", function(b) { return favStrokecale(b.values[0].authorRank); })
		.style("opacity", function(b) { return b.values[0].favAuthor === 1 ? 0.9 : 0.4; });
}//function mouseOutAll

///////////////////////////////////////////////////////////////////////////
/////////////////////////// Extra functions ///////////////////////////////
///////////////////////////////////////////////////////////////////////////

//Round number to 2 behind the decimal
function round2(num) {
	return (Math.round(num * 100)/100).toFixed(2);
}//round2



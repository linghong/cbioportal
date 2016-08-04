// $Id: webstart.js,v 1.13 2008-01-14 15:05:28 grossben Exp $
//------------------------------------------------------------------------------
/** Copyright (c) 2007 Memorial Sloan-Kettering Cancer Center.
 **
 ** Code written by: Ethan Cerami, Benjamin Gross
 ** Authors: Ethan Cerami, Gary Bader, Chris Sander, Benjamin Gross
 ** Modified by Jim Robinson for use with IGV
 **
 ** This library is free software; you can redistribute it and/or modify it
 ** under the terms of the GNU Lesser General Public License as published
 ** by the Free Software Foundation; either version 2.1 of the License, or
 ** any later version.
 **
 ** This library is distributed in the hope that it will be useful, but
 ** WITHOUT ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF
 ** MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  The software and
 ** documentation provided hereunder is on an "as is" basis, and
 ** Memorial Sloan-Kettering Cancer Center
 ** has no obligations to provide maintenance, support,
 ** updates, enhancements or modifications.  In no event shall
 ** Memorial Sloan-Kettering Cancer Center
 ** be liable to any party for direct, indirect, special,
 ** incidental or consequential damages, including lost profits, arising
 ** out of the use of this software and its documentation, even if
 ** Memorial Sloan-Kettering Cancer Center
 ** has been advised of the possibility of such damage.  See
 ** the GNU Lesser General Public License for more details.
 **
 ** You should have received a copy of the GNU Lesser General Public License
 ** along with this library; if not, write to the Free Software Foundation,
 ** Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA.
 **/



/*
 * Javascript library to communication with java webstart application
 */

// globals
var SCRIPT_ELEMENT_ID = "igv";
var timeoutVar; // used to set/unset timeout handlers
var sessionURL; // the session (or data) url
var genome; // the genome parameter
var locus;  // the locus parameter
var name;   // the name parameter
var merge;
var igv_data_fetched = false;
var segGene = [];
var segCNUrl;
var fetchedFileData ={};

var data ={};
var geneCNAData = [];
var samples = [];
var sample ={};
/*
 * Function to determine webstart version - taken from sun site
 */
function webstartVersionCheck(versionString) {
    // Mozilla may not recognize new plugins without this refresh
    navigator.plugins.refresh(true);
    // First, determine if Web Start is available
    if (navigator.mimeTypes['application/x-java-jnlp-file']) {
        // Next, check for appropriate version family
        for (var i = 0; i < navigator.mimeTypes.length; ++i) {
            var pluginType = navigator.mimeTypes[i].type;
            if (pluginType == "application/x-java-applet;version=" + versionString) {
                return true;
            }
        }
    }
    return true;
}

/*
 * Handler function to launch IGV via java web start.  This handler is scheduled in the appRequest() function, and
 * is canceled by the callBack() function called in the response to the "localhost" request.  If callBack() is not
 * invoked we conclude IGV is not running and launch it via Java WebStart.
 */
function timeoutHandler() {

    var webstart_url = "http://www.broadinstitute.org/igv/projects/current/igv.php";
    if (sessionURL.indexOf("dataformat=.bam") != -1) {
        webstart_url = "http://www.broadinstitute.org/igv/projects/dev/igv_su2c.php";
    }

    if (sessionURL) {
        webstart_url += "?sessionURL=" + sessionURL;
        if (genome) {
            webstart_url += "&genome=" + genome;
        }
        if (locus) {
            webstart_url += "&locus=" + locus;
        }
        if (name) {
            webstart_url += "&name=" + name;
        }
        if (merge) {
            webstart_url += "&merge=" + merge;
        }
    }

    // determine if webstart is available - code taken from sun site
    var userAgent = navigator.userAgent.toLowerCase();
    // user is running windows
    if (userAgent.indexOf("msie") != -1 && userAgent.indexOf("win") != -1) {
        document.write("<OBJECT " +
            "codeBase=http://java.sun.com/update/1.5.0/jinstall-1_5_0_05-windows-i586.cab " +
            "classid=clsid:5852F5ED-8BF4-11D4-A245-0080C6F74284 height=0 width=0>");
        document.write("<PARAM name=app VALUE=" + webstart_url + ">");
        document.write("<PARAM NAME=back VALUE=true>");
        // alternate html for browsers which cannot instantiate the object
        document.write("<A href=\"http://java.sun.com/j2se/1.5.0/download.html\">Download Java WebStart</A>");
        document.write("</OBJECT>");
    }
    // user is not running windows
    else if (webstartVersionCheck("1.6")) {
        window.location = webstart_url;
    }
    // user does not have jre installed or lacks appropriate version - direct them to sun download site
    else {
        window.open("http://jdl.sun.com/webapps/getjava/BrowserRedirect?locale=en&host=java.com",
            "needdownload");
    }
}

/*
 * This function is called by IGV in the response to the GET request to load the data.  It cancels the JNLP load.
 */
function callBack() {
    clearTimeout(timeoutVar);
}

/*
 * Called to disable a link to the webstart.
 */
function disableLink(linkID) {

    var link = document.getElementById(linkID);
    if (link) {
        link.onclick = function() {
            return false;
        };
        link.style.cursor = "default";
        link.style.color = "#000000";
    }
}

/**
 * This function is called from a link or button to load data into IGV.  First,  an attempt is made to load the
 * supplied data into a running IGV.  If this is not successful, as detected by a failure to cancel the timeoutHandler,
 * IGV is launched by JNLP.
 *
 * The first 2 arguments are required.  Remaining arguments are optional but must appear in the prescribed order.
 *
 * @param port -- the IGV port, typically 60151
 * @param dataUrl -- an http or ftp url to the data.
 * @param genomeID -- the genomeID,  e.g. hg18
 * @param mergeFlag -- flag to indicate if data should be merged with current IGV session, or should start a new session
 * @param locusString -- an IGV locus string, e.g. chr1:100,000-200,000  or EGFR.  See IGV doc for full details
 * @param trackName -- name for the track resulting from dataURL.  This only works for "single-track" formats, e.g. wig.
 */
function appRequest(port, dataUrl, genomeID, mergeFlag, locusString, trackName) {

    // be good and remove the previous cytoscape script element
    // although, based on debugging, i'm not sure this really does anything
    var oldScript = document.getElementById(SCRIPT_ELEMENT_ID);
    if (oldScript) {
        oldScript.parentNode.removeChild(oldScript);
    }

    var localURL = "http://127.0.0.1:" + port + "/load?file=" + dataUrl + "&callback=callBack();";

    sessionURL = dataUrl;
    genome = genomeID;
    locus = locusString;
    merge = mergeFlag;
    name = trackName;


    if (genomeID) {
        localURL += "&genome=" + genomeID;
    }
    if (locusString) {
        localURL += "&locus=" + locusString;
    }
    if (mergeFlag) {
        localURL += "&merge=" + mergeFlag;
    }
    if (trackName) {
        localURL += "&name=" + trackName;
    }


    // create new script
    var newScript = document.createElement("script");
    newScript.id = SCRIPT_ELEMENT_ID;
    newScript.setAttribute("type", "text/javascript");
    newScript.setAttribute("src", localURL);

    // add new script to document (head section)
    var head = document.getElementsByTagName("head")[0];
    head.appendChild(newScript);

    // disable link
    // we do this because some browsers
    // will not fetch data if the url has been fetched in the past
    //disableLink("1");

    // set timeout - handler for when IGV is not running
    timeoutVar = setTimeout("timeoutHandler()", 2000);
}

var prepIGVForSegView = function (_studyId) {
    
    if (!igv_data_fetched) {
        $.when($.ajax({
            method : "POST",
            url : 'igvlinking.json',
            data : {
                cmd : 'get_igv_args',
                cancer_study_id : _studyId,
                gene_list : window.QuerySession.getQueryGenes().join(" ")
            }
        })).then(
                function(response) {                    
                    segGene =response['geneList'].split('+');
                    segCNUrl=response['segfileUrl'];
                    igv_data_fetched = true; 
                    addIGVButtons(segGene);
                    startIGV (segGene[0].toLowerCase(), segCNUrl);
                    fetchedFileData =new ReadTextFile(segCNUrl);                   
                });
        
    } 
}

//The parameter genes is an array
var addIGVButtons = function (genes){

     $("#all_genes").hide();
    var buttonNumber = genes.length+1;    
    for (i=0; i<buttonNumber-1; i++){
        $('#switchGenes').append(
            '<li class="ui-state-default ui-corner-top" role="tab" tabindex="0" >'+
            '<a href="#" class="ui-tabs-anchor" onclick="switchGenes('+"'"+genes[i]+"'"+')"><span>' +genes[i]+'</span></a>'+
            '</li>');
    }
 
    $('#switchGenes').append(
            '<li class="ui-state-default ui-corner-top" role="tab" tabindex="0" >'+
            '<a href="#" class="ui-tabs-anchor" onclick="showAllGenesPanel('+"'"+genes+"'"+')"><span>' +"All Genes"+'</span></a>'+
            '</li>');
   
}

var switchGenes = function(buttonVal){

    startIGV(buttonVal.toLowerCase(), segCNUrl);  
    $("#all_genes").hide();  
}

//genes is an array
var showAllGenesPanel = function (genes){
    
    $("#all_genes").show();
    
    var genesArray = genes.split(',');
    var inputNumber = genesArray.length; 

    if($('input[name="sort"]').length==0){
        for (i=0; i<inputNumber; i++){
            $("#sort").append(
            '<label><input type="radio" name="sort" value="' + genesArray[i]+'"  onclick="checkedSort()"/>'+genesArray[i]+'</label>'); 
        }
    }
   
    if(allGenesCN==false) {
        for (i=0; i<inputNumber; i++){
            $("#d3_segment").append(
            '<div class="col-lg-4 col-md-4 col-sm-4 geneName">'+genesArray[i]+'</h1></div>');  
        }
       startAllGenes(genesArray);
    }
    $("#igvRootDiv").hide();
}

var allGenesCN = false;
var startAllGenes = function(genesArray){
    allGenesCN = true;

    d3.json("data/cbioportal_TCGA_small.json", function(dat) {

        fetchedFileData.read();        
        var lines=[];
        lines = allText.split('\n');

    /*   var geneinfo = new BroadInstituteGeneInfo (genesArray);
        geneinfo.getGeneMapping();
    */  

        var geneMapping={
                        "KRAS": {
                                 "chr": 12,
                                "bpStart": 25204789,
                                "bpEnd": 25252093
                                },
                        "NRAS": {
                                "chr": 1,
                                "bpStart": 115247084,
                                "bpEnd": 115259515 
                                },
                        "BRAF": {"chr": 7,
                                "bpStart": 140433812,
                                "bpEnd": 140624564
                                }
                        };
  
        for(j =0; j<genesArray.length; j++){
            var geneName= genesArray[j];
            var chrSegment=[];  
            data['"'+geneName+'"']=[];
            for(var i=1; i<lines.length-1; i++){
             
                var allSegment = lines[i].split('\t');                 
 
      /*             var previousName = "";
        var count =0;  

       while(j=0) {
                    if(previousName != allSegment[0]){                        
                       sample['"'+allSegment[0]+'"']=0; 
                       samples.push({sample});
                        previousName = allSegment[0],
                        count++;
                    }
                }                   
    */
                var geneChr = geneMapping[geneName].chr.toString();

                if (allSegment[1]===geneChr){

                    chrSegment.push(
                       {
                        "sample": allSegment[0],
                        "chr": parseInt(allSegment[1]),
                        "CNStart": parseInt(allSegment[2]),
                        "CNEnd": parseInt(allSegment[3]),
                        "num_probes": parseInt(allSegment[4]),
                        "CNValue": parseFloat(allSegment[5])
                    });
                    /*if(samples.hasOwnProperty(allSegment[0])==false){
                        samples.push(allSegment[0]);
                    }
                    */
                } 

            }

            for (var i=0; i<chrSegment.length; i++){
                var genebpEnd = geneMapping[geneName].bpEnd;
                var genebpStart = geneMapping[geneName].bpStart; 
                var bpStart;
                var bpEnd;

                var previousName = "";
                var count=0;
                if(chrSegment[i].CNEnd>=genebpStart &&chrSegment[i].CNStart<=genebpEnd){
                    count++;

                    if(chrSegment[i].CNStart < genebpStart){
                        bpStart = genebpStart;
                    } else {
                        bpStart = chrSegment[i].CNStart;
                    }
                    
                    if(chrSegment[i].CNEnd > genebpEnd){
                        bpEnd = genebpEnd;
                    } else {
                        bpEnd = chrSegment[i].CNEnd;
                    }

                    var averageVal = chrSegment[i].CNValue
                    var sampleName = chrSegment[i].sample;
          
               
                    data['"'+geneName+'"'].push(
                       {
                        "sample": chrSegment[i].sample,
                        "chr": chrSegment[i].chr,
                        "start": bpStart,
                        "end": bpEnd,
                        "num_probs": chrSegment[i].num_probes,
                        "value": averageVal
                       });
                } else{
                    
                }

     
           /* var geneSegmentVal = (bpEnd-bpStart)*averageVal; 
              var value =  samples['"'+data['"'+geneName+'"'].sample+'"'] ;
               samples['"'+data['"'+geneName+'"'].sample+'"'] = value -1+ geneSegmentVal;
                console.log("samples");
                console.log(samples);
            */
            }

        }

        var segmenCNViz= new D3SegmentCNViz(data, genesArray); 
         
        //sorting bar chart                
        d3.selectAll('input[name="sort"]').on("click", function(){ 
            sortBars(data);
            //maintain an original aggregated/unaggregated and sorted/unsorted status
            segmenCNViz.update(refined_data,sortChecked);
        }); 

        //function for sorting bars
        var direction="original";
        var sortBars=function(data){  
    
            if(direction === "ascending"){
                refined_data=data['"'+sortChecked+'"'].sort(function(a,b){return d3.descending(a.value, b.value)});
                direction = "descending";
            } else{
                refined_data=data['"'+sortChecked+'"'].sort(function(a,b){return d3.ascending(a.value, b.value)});
                direction = "ascending";
            }
        } 
      
    });
}

  //function for checking which sorted radio box is checked
    var sortChecked ="";
    function checkedSort(){
        d3.selectAll('input[name="sort"]').each(function (d) {
            if(d3.select(this).attr("type") == "radio" &&d3.select(this).node().checked) {
                sortChecked =d3.select(this).attr("value");
            }         
        });    
    }      

var startIGV = function(targetGene, segUrl) {

    options = {
                showNavigation: true,
                showRuler: true,
                genome: "hg19",
                locus: targetGene,
                tracks: [
                    {
                        url: segUrl,
                        indexed: false,
                        name: 'Segmented CN'
                    },
                    {
                        name: "Genes",
                        url: "https://s3.amazonaws.com/igv.broadinstitute.org/annotations/hg19/genes/gencode.v18.collapsed.bed",
                        order: Number.MAX_VALUE,
                        displayMode: "EXPANDED"
                    }
                ]
            };
     
    igv.createBrowser("#igv_tab", options);
/*
    config = {
    format:"seg",
    indexed: false, 
    name: "Segmented CN", 
    order: 1, 
    sourceType:"file",
    type:"seg",
    url:"http://cbio.mskcc.org/cancergenomics/public-portal/seg/coadread_tcga_pub_data_cna_hg19.seg"
}
*/
}

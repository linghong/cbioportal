

function plotMutVsCna(csObs,divId,caseIdDiv,cancerStudyId,dt,emphasisCaseId,colCna,colMut,caseMap,hLog,vLog) {
        var scatterDataView = new google.visualization.DataView(dt);
        var params = [
            colCna,
            colMut,
            {
                calc:function(dt,row){
                    return dt.getValue(row,0)+'\n('+(dt.getValue(row,colCna)*100).toFixed(1)+'%, '+dt.getValue(row,colMut)+')';
                },
                type:'string',
                role:'tooltip'
            }
        ];
        if (emphasisCaseId)
            params.push({
                calc:function(dt,row){
                    return dt.getValue(row,0)===emphasisCaseId ? dt.getValue(row,colMut) : null;
                },
                type:'number'
            });
        scatterDataView.setColumns(params);
        var scatter = new google.visualization.ScatterChart(document.getElementById(divId));
        
        if (csObs) {
            google.visualization.events.addListener(scatter, 'select', function(e){
                var s = scatter.getSelection();
                if (s.length>1) return;
                var caseId = s.length==0 ? null : dt.getValue(s[0].row,0);
                $('#'+caseIdDiv).html(formatPatientLink(caseId,cancerStudyId));
                csObs.fireSelection(caseId, divId);
                resetSmallPlots();
            });

            google.visualization.events.addListener(scatter, 'ready', function(e){
                csObs.subscribe(divId,function(caseId) {
                    if (caseId==null) {
                        scatter.setSelection(null);
                        $('#'+caseIdDiv).html("");
                    }
                    if ((typeof caseId)==(typeof "")) {
                        var ix = caseMap[caseId];
                        scatter.setSelection(ix==null?null:[{'row': ix}]);
                        $('#'+caseIdDiv).html(formatPatientLink(caseId,cancerStudyId));
                    } else if ((typeof caseId)==(typeof {})) {
                        var rows = [];
                        for (var id in caseId) {
                            var row = caseMap[id];
                            if (row!=null)
                                rows.push({'row':caseMap[id]});
                        }
                        scatter.setSelection(rows);
                        $('#'+caseIdDiv).html(rows.length==1?formatPatientLink(id):"");
                    } 
                },true);
            });
        }
        
        var options = {
            hAxis: {title: "Copy number alteration fraction", logScale:hLog, format:'#%'},
            vAxis: {title: "# of mutations", logScale:vLog, format:'#,###'},
            legend: {position:'none'}
        };
        scatter.draw(scatterDataView,options);
        return scatter;
}

function loadMutCountCnaFrac(caseIds,cancerStudyId,mutationProfileId,hasCnaSegmentData,func) {

    var mutDataTable = null;
    if (mutationProfileId!=null) {
        var params = {
            cmd: 'count_mutations',
            case_ids: caseIds.join(' '),
            mutation_profile: mutationProfileId
        };

        $.post("mutations.json", 
            params,
            function(mutationCounts){
                var wrapper = new DataTableWrapper();
                wrapper.setDataMap(mutationCounts,['case_id','mutation_count']);
                mutDataTable = wrapper.dataTable;
                mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
                            mutDataTable,cnaDataTable,func);
            }
            ,"json"
        );
    }


    var cnaDataTable = null;

    if (hasCnaSegmentData) {
        var params = {
            cmd: 'get_cna_fraction',
            case_ids: caseIds.join(' '),
            cancer_study_id: cancerStudyId
        };

        $.post("cna.json", 
            params,
            function(cnaFracs){
                var wrapper = new DataTableWrapper();
                // TODO: what if no segment available
                wrapper.setDataMap(cnaFracs,['case_id','copy_number_altered_fraction']);
                cnaDataTable = wrapper.dataTable;
                mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
                            mutDataTable,cnaDataTable,func);
            }
            ,"json"
        );
    }
}

function mergeTablesAndCallFunc(mutationProfileId,hasCnaSegmentData,
        mutDataTable,cnaDataTable,func) {
    if ((mutationProfileId!=null && mutDataTable==null) ||
        (hasCnaSegmentData && cnaDataTable==null)) {
        return;
    }

    if (func) {
        func.call(window,mergeMutCnaTables(mutDataTable,cnaDataTable));
    }
}

function mergeMutCnaTables(mutDataTable,cnaDataTable) {
    if (mutDataTable==null)
        return cnaDataTable;
    if (cnaDataTable==null)
        return mutDataTable;

     return google.visualization.data.join(mutDataTable, cnaDataTable,
                'full', [[0,0]], [1],[1]);
}
// get the shader source by its id .......................................
function source(id){
    return document.getElementById(id).text ;
}

// Get the canvas ........................................................
var canvas_1 = document.getElementById('canvas_1') ;
var canvas_2 = document.getElementById('canvas_2') ;
var canvas_3 = document.getElementById('canvas_3') ;
var canvas_4 = document.getElementById('canvas_4') ;

// Object to be used for interactions ....................................
var env = {} ;

env.width               = 512 ;
env.height              = 512 ;
env.a                   = 0.1 ;
env.b                   = 0.3 ;
env.epsilon             = 0.01 ;

env.dt                  = 0.05 ;
env.diffCoef            = 0.001 ;
env.time                = 0 ;

env.running             = false ;
env.skip                = 40 ;
    
env.period              = 200 ;
env.pacemakerActive     = false ;
env.pacemakerRadius     = 0.1 ;
env.pacemakerX          = 0. ;
env.pacemakerY          = 0. ;
env.pacemakerCircular   = true ;

// defining the textures .................................................
var fcolor = new Abubu.Float32Texture(512,512, 
    { pairable : true } ) ;
var scolor = new Abubu.Float32Texture(512,512 ) ;
scolor.pairable = true ;

// Setup a solver ........................................................
var init = new Abubu.Solver( {
    fragmentShader  : source('init'),
    targets : {
        color1 : { location :0, target : fcolor  } ,
        color2 : { location :1, target : scolor  } ,

    }
} ) ;
init.render() ;

// marching steps ........................................................
function marchUniforms(_inTexture){
    this.inTexture          = { type : 't', value : _inTexture          } ; 
    this.dt                 = { type : 'f', value : env.dt              } ; 
    this.diffCoef           = { type : 'f', value : env.diffCoef        } ; 
    this.period             = { type : 'f', value : env.period          } ;
    this.a                  = { type : 'f', value : env.a               } ;
    this.b                  = { type : 'f', value : env.b               } ;
    this.epsilon            = { type : 'f', value : env.epsilon         } ;
    this.pacemakerActive    = { type : 'b', value : env.pacemakerActive } ;
    this.pacemakerCircular  = { type : 'b', value : env.pacemakerCircular} ;
    this.pacemakerRadius    = { type : 'f', value : env.pacemakerRadius } ;
    this.pacemakerX         = { type : 'f', value : env.pacemakerX      } ;
    this.pacemakerY         = { type : 'f', value : env.pacemakerY      } ;
    return this ;
}

// even (f) time steps ---------------------------------------------------
var fmarch = new Abubu.Solver({
        fragmentShader : source( 'march' ) ,
        uniforms : new marchUniforms( fcolor ) ,
        targets : {
                ocolor : { location : 0, target : scolor } 
        }
    } ) ;

// odd (s) time steps ----------------------------------------------------
var smarch = new Abubu.Solver({
        fragmentShader : source( 'march' ) ,
        uniforms : new marchUniforms( scolor ) ,
        targets : {
                ocolor : { location : 0, target : fcolor } 
        }
    } ) ;

// defibriliate ----------------------------------------------------------
function readOption( opt, def ){
    return (opt) ? opt : def ;
}
class ElectrodeDefibrilator{
    constructor(opts={}){
        // read all constructor options ..................................
        this._mx            = readOption( opts.mx ,             8       ) ;
        this._my            = readOption( opts.my ,             8       ) ;
        this._fcolor        = readOption( opts.fcolor ,         null    ) ;
        this._scolor        = readOption( opts.scolor ,         null    ) ;
        this._thickness     = readOption( opts.thickness,       0.04    ) ;
        this._uThreshold    = readOption( opts.uThreshold,      0.3     ) ;
        this._vThreshold    = readOption( opts.vThreshold,      0.07    ) ;
        this._electrodeSize = readOption( opts.electrodeSize,   0.03    ) ;

        this._electrodeCoordinates = 
            new Abubu.Float32Texture( this.mx, this.my ) ;

        this._stimulationRegion = 
            new Abubu.Float32Texture( this.width, this.height) ;
        
        this._activeElectrodes = 
            new Abubu.Float32Texture(this.mx, this.my );

        // coordinator ...................................................
        this.coordinator = new Abubu.Solver({
            fragmentShader : source( 'coordinator' ) ,
            targets : {
                crd : { location : 0 , target : this.electrodeCoordinates}
            }
        } ) ;
        this.coordinator.render() ;

        // determine stimulation region ..................................
        this.step1 = new Abubu.Solver({
            fragmentShader : source( 'defib_s1' ) ,
            uniforms : { 
                icolor      : { type : 's' ,     value : this.fcolor , 
                    magFilter: 'linear' } ,
                thickness   : { type : 'f', value : this.thickness  } ,
                uThreshold  : { type : 'f', value : this.uThreshold } ,
                vThreshold  : { type : 'f', value : this.vThreshold } ,
            } ,
            //canvas : document.getElementById('canvas_5') ,
            targets : {
                ocolor : { location : 0, target : this.stimulationRegion }
            } 
        } ) ;

        // determine active electrodes ...................................
        this.step2 = new Abubu.Solver({
            fragmentShader : source( 'defib_s2') ,
            uniforms :{
                icolor : { type : 't', value : this.stimulationRegion } ,
                mx      : { type : 'i', value : this.mx } ,
                my      : { type : 'i', value : this.my } ,
            } ,
            targets : {
                ocolor : { location : 0 , target: this.activeElectrodes }
            }
        } ) ;
 
        // defib using electrodes ........................................
        this.step3 = new Abubu.Solver({
            fragmentShader : source('defib_s3') ,
            uniforms : {
                icolor : { type : 't', value : this.fcolor } ,
                activeElectrodes : {
                    type : 't', value : this.activeElectrodes } ,
                electrodeCoordinates :{
                    type : 's', value : this.electrodeCoordinates ,
                    minFilter : 'nearest', magFilter: 'nearest' } ,
                electrodeSize : { type : 'f', value : this.electrodeSize }
            } ,
            targets : {
                ocolor : { location : 0, target : this.scolor } ,
            } 
        } ) ;

        // last step of defib ............................................
        this.step4 = new Abubu.Copy( this.scolor , this.fcolor )  ;


    } // end of constructor ----------------------------------------------

    get fcolor(){
        return this._fcolor ;
    }
    get scolor(){
        return this._scolor ;
    }
    get width(){
        return this.fcolor.width ;
    }
    get height(){
        return this.fcolor.height ;
    }

    get electrodeCoordinates(){
        return this._electrodeCoordinates ;
    }

    get stimulationRegion(){
        return this._stimulationRegion ;
    }
    get activeElectrodes(){
        return this._activeElectrodes ;
    }

    // mx ................................................................
    get mx(){
        return this._mx ;
    }
    set mx(m){
        this._mx = m ;
        this.activeElectrodes.width = this.mx ;
        this.electrodeCoordinates.width = this.mx ;
        this.step2.uniforms.mx.value = this.mx ;
        this.coordinator.render() ;
    }

    // mty ...............................................................
    get my(){
        return this._my ;
    }
    set my(m){
        this._my = m ;
        this.activeElectrodes.height = this.my ;
        this.electrodeCoordinates.height = this.my ;
        this.step2.uniforms.my.value = this.my ;
        this.coordinator.render() ;
    }

    // electrodeSize .....................................................
    get electrodeSize(){
        return this._electrodeSize ;
    }
    set electrodeSize(ns){
        this._electrodeSize = ns ;
        this.step3.uniforms.electrodeSize.value = ns ;
    }

    // thickness .........................................................
    get thickness(){
        return this._thickness ; 
    }
    set thickness(nv){
        this._thickness = nv ;
        this.step1.uniforms.thickness.value = nv ;
    }

    // tThreshold ........................................................
    get uThreshold(){
        return this._uThreshold ;
    }
    set uThreshold(ut){
        this._uThreshold = ut ;
        this.step1.uniforms.uThreshold.value = ut ;
    }

    // vThreshold ........................................................
    get vThreshold(){
        return this._vThreshold ;
    }
    set vThreshold(vt){
        this._vThreshold = vt ;
        this.step1.uniforms.vThreshold.value = vt ;
    }

    // run ...............................................................
    run(){
        this.step1.render() ;
        this.step2.render() ;
        this.step3.render() ;
        this.step4.render() ;
    }
    render(){
        this.run() ;
    }

    defibrillate(){
        this.run() ;
    }
}

env.uThreshold = 0.3
env.vThreshold = 0.07 ;

env.defib = new ElectrodeDefibrilator({
    mx : 16 , my :16 , fcolor : fcolor, scolor : scolor,
    thickness : 0.02 , electrodeSize : 0.04, 
    uThreshold : env.uThreshold, 
    vThreshold : env.vThreshold,
} ) ;

env.defibrillate = function(){
    env.defib.run() ;
    refreshDisplay() ;
}

// march the solution for two time steps ---------------------------------
function march(){
    fmarch.render() ;
    smarch.render() ;
    env.time += env.dt*2. ;
}

/*------------------------------------------------------------------------
 * Post processing 
 *------------------------------------------------------------------------
 */

// 2D plots --------------------------------------------------------------

// uplot .................................................................
var uplot = new Abubu.Plot2D({
    target : fcolor,            /* the texture to visualize             */
    channel : 'r',              /* the channel of interest:
                                        can be : 'r', 'g', 'b', or 'a' 
                                        defualt value is 'r'            */
    minValue : -.2 ,            /* minimum value on the colormap        */
    maxValue : 0.9 ,            /* maximum value on the colormap        */
    colorbar : true ,           /* if you need to show the colorbar     */
    probeVisible : true ,
    canvas : canvas_1 ,         /* the canvas to draw on                */
}) ;

uplot.addMessage('FitzHugh-Nagumo Model', 0.05,0.05,{
    font : 'Bold 12pt Arial' ,
    align : 'start',
    style : '#ffffff', 
    } ) ;

uplot.time = uplot.addMessage('Time = 0.00 ms' , 0.05,0.13,{
    font : '11pt Arial' ,
    align : 'start',
    style : '#ffffff', 
} ) ;

uplot.init() ;   /* initialize the plot */
uplot.render() ;

// thresholdPlot .........................................................
var thresholdPlot = new Abubu.Solver({
    fragmentShader : source("2dPhaseMap") ,
    uniforms : {
        inColor : { type : 't', value : fcolor } ,
        thickness  : { type : 'f', value : env.thickness   } ,
        uThreshold : { type : 'f', value : env.uThreshold  } ,
        vThreshold : { type : 'f', value : env.vThreshold  } ,
    } ,
    canvas : canvas_2 
} ) ;

// phase plot ------------------------------------------------------------
var pplot = new Abubu.PhasePlot({
    canvas : canvas_4 ,
    grid : 'on',
    probePosition : [0.5,0.5], 

    // horizontal axis info
    xcolor : fcolor ,
    xchannel : 'g' ,
    xmin    : -0.05 ,
    xmax    : 0.15 ,
    nx      : 4, 

    // vertical axis info
    ycolor      : fcolor ,
    ychannel    : 'r' ,
    ymin        : -.3 ,
    ymax        : 1. ,
    ny          : 13, 

    // xticks
    xticks : {  
        mode : 'auto', 
        unit : '', 
        font : '11pt Times' , precision : 2 } ,
    
    // yticks
    yticks : {  
        mode : 'auto', unit : '', font : '11pt Times', 
        precision : 1 } ,
}) ; 

// signal plots ----------------------------------------------------------
var splot = new Abubu.SignalPlot({
    noPltPoints : 1024, // number of sample points
    grid : 'on', 
    nx   : 10 , // number of division in x 
    ny   : 13 , // ... in y 

    xticks : {  mode : 'auto', unit : 'ms', font : '11pt Times' } ,
    yticks : {  mode : 'auto', unit : '' , 
                font : '12pt Times',precision : 1  } ,
    canvas : canvas_3 
} ) ;

splot.addMessage(
    'Signal at the probe', 0.5,0.05,{
        font : 'Bold 14pt Arial' ,
        align: 'center',
        style: "#ff0000" ,
    } ) ;

// v-signal ..............................................................
env.vsgn = splot.addSignal( fcolor, {
    channel : 'g',
    minValue : -.3,
    maxValue : 1.0 ,
    restValue : 0 ,
    color : [ 0.,.4,0.0 ],
    visible : true ,
    timewindow : 1000 , 
    probePosition : [0.5,0.5] 
} ) ;

// u-signal ..............................................................
env.usgn = splot.addSignal( fcolor, {
    channel : 'r',
    minValue : -.3,
    maxValue : 1.0 ,
    restValue : 0 ,
    color : [ .4,0.,0.0 ],
    visible : true ,
    timewindow : 1000 , 
    probePosition : [0.5,0.5] 
} ) ;

// updateSignals ---------------------------------------------------------
function updateSignals(){
    env.usgn.update(env.time) ;
    env.vsgn.update(env.time) ;
}

// refreshDisplay ........................................................
function refreshDisplay(){
    splot.render() ;
    pplot.render() ; 
    uplot.time.text = "Time = " + env.time.toFixed(2) + " ms" ;
    uplot.init() ;
    uplot.render() ;
    thresholdPlot.render() ;
}

// initialize program ....................................................
env.initialize = function(){
    env.time = 0 ;
    init.render() ;
    splot.init() ;
    pplot.init() ;
    env.usgn.init(0) ;
    env.vsgn.init(0) ;
    uplot.init() ;
}

// solution and visualization sequence ...................................
env.alwaysRefresh = true ;
function run(){
    if (env.running){
        for(var i = 0 ; i<env.skip ; i++){
            march() ;
            updateSignals() ;
        }
    }
    if ( env.running || env.alwaysRefresh ){
        refreshDisplay() ;
    }
    requestAnimationFrame(run) ;
}

// click -----------------------------------------------------------------

// click defaults
env.clickRadius         = 0.1 ;
env.clickPosition       = [0.,0.] ;
env.clickU      = 1. ;
env.clickV      = 0. ;
env.clickAlterU = true ;
env.clickAlterV = false ;

var click = new Abubu.Solver({
    fragmentShader : source( 'click' ) ,
    uniforms : {
        inTexture : { type : 't', value : fcolor } ,
        clickRadius: { type : 'f', value : env.clickRadius } ,
        clickPosition: { type : 'v2', value : env.clickPosition } ,
        clickU      : { type : 'f', value : env.clickU          } ,
        clickV      : { type : 'f', value : env.clickV          } ,
        clickAlterU : { type : 'b', value : env.clickAlterU     } ,
        clickAlterV : { type : 'b', value : env.clickAlterV     } ,
    } ,
    targets : {
            ocolor : { location : 0 , target : scolor } ,
    }
} ) ;

var clickCopy = new Abubu.Copy( scolor, fcolor ) ;

var mouseDrag_1 = new Abubu.MouseListener({
    canvas : canvas_1 ,
    event : 'drag' ,
    callback : function(e){
        click.uniforms.clickPosition.value = e.position ;
        click.render() ;
        clickCopy.render() ;
        refreshDisplay() ;
    }
} ) ; 

var mouseDrag_2 = new Abubu.MouseListener({
    canvas : canvas_2 ,
    event : 'drag' ,
    callback : function(e){
        click.uniforms.clickPosition.value = e.position ;
        click.render() ;
        clickCopy.render() ;
        refreshDisplay() ;
    }
} ) ; 


// set probe position ....................................................
var setProbe = new Abubu.MouseListener({
    canvas : canvas_1 ,
    event  : 'click' ,
    shift  : true ,
    callback : function(e){
        pplot.probePosition = e.position ;
        pplot.init() ;
        uplot.setProbePosition(e.position) ;
        splot.setProbePosition(e.position) ;
        splot.init() ;
        pplot.init() ;
        uplot.init() ;
        
        refreshDisplay() ;
    }
} ) ;

var setProbe = new Abubu.MouseListener({
    canvas : canvas_2 ,
    event  : 'click' ,
    shift  : true ,
    callback : function(e){
        pplot.probePosition = e.position ;
        pplot.init() ;
        uplot.setProbePosition(e.position) ;
        splot.setProbePosition(e.position) ;
        splot.init() ;
        pplot.init() ;
        uplot.init() ;
        refreshDisplay() ;
    }
} ) ;


// saveCsvFile : save an array to disk as comma separated values .........
env.csvFileName = 'fcolor.csv' ;
env.saveCsvFile = function(){
    var link = document.createElement('a') ;
    var data = "data:text;charset=utf-8," +
        fcolor.width + ',' + 
        fcolor.height ;  
    var width = fcolor.width ;
    var height= fcolor.height ;
    var fval  = fcolor.value ;

    for(var i=0 ; i<(width*height) ; i++){
        var indx = i*4 ;
        data += ','+ 
        fval[indx  ].toExponential()+ ',' +
        fval[indx+1].toExponential()+ ',' +
        fval[indx+2].toExponential()+ ',' +
        fval[indx+3].toExponential() ;
    }

    var csv = encodeURI( data ) ;
    link.setAttribute( 'href', csv ) ;
    link.setAttribute( 'download', env.csvFileName ) ;
    link.click() ;
}

// loadCsvFile  : read a CSV file into the html page .....................
env.loadCsvFile = document.createElement('input') ;
env.loadCsvFile.setAttribute('type', 'file') ;
env.loadCsvFile.onchange = function(){
    /* check if a no file was selected */
    if ( !env.loadCsvFile.files[0] ){        
        return ;
    } ;

    var file = env.loadCsvFile.files[0] ;
    var reader = new FileReader() ;
    reader.readAsText(file) ;

    // only the when the file is loaded it can be analyzed
    reader.onload = function(event){
        var result  = event.target.result ;
        var data = result.split(',') ;

        var width = parseInt(data[0]) ;
        var height = parseInt(data[1]) ;

        var table = new Float32Array(width*height*4) ;
        var p = 0 ;
        for (var i=2 ; i< data.length; i++){ // modify accordingly
            table[p++] = parseFloat( data[i]) ;
        }

        fcolor.data = table ;
        scolor.data = table ;
    }
}

// add multiple parameters to gui ........................................
function addToGui( 
        guiElemenent ,  // gui element to add options into
        obj,            // object that holds parameters
        paramList,      // array of strings that contains list 
                        // of parmeters to be added
        solverList      // array of solvers that need to be update upon 
                        // change of a parameter through gui interactions
    ){
    var elements = {} ;
    for(i in paramList){
        var param = paramList[i] ;
        elements[param] = guiElemenent.add(obj, param )  ;
        elements[param].onChange(function(){
            Abubu.setUniformInSolvers( 
                    this.property , // this refers to the GUI element 
                    this.object[this.property] , 
                    solverList ) ;
        } ) ;
    }
    return elements ;
}

// .......................................................................
// create the graphical user interface 
// .......................................................................
function createGui(){
    var gui = new Abubu.Gui() ;     /*  create a graphical user 
                                        interface               */
    var panel = gui.addPanel({width:300}) ; // add a panel to the GUI


    // model parameters added to GUI -------------------------------------
    var mdl = panel.addFolder('Model Parameters') ;
    mdl.elements = addToGui( mdl, env, 
            ['a','b','epsilon','dt','diffCoef'], 
            [fmarch, smarch] ) ;

    // pace maker --------------------------------------------------------
    var pcm = panel.addFolder('Pace Maker') ;
    pcm.elements = addToGui( pcm, env, 
            [   'pacemakerActive' ,
                'pacemakerCircular' ,
                'pacemakerX' ,
                'pacemakerY' ,
                'pacemakerRadius' ,
                'period'            ], 
            [fmarch , smarch] ) ;

    pcm.elements.period.step(1) ;

    // clicker -----------------------------------------------------------
    var clk = panel.addFolder("Click") ;
    clk.elements = addToGui( clk, env,
        [ 
            "clickRadius", 
            "clickU", 
            "clickV",
            "clickAlterU" ,
            "clickAlterV" ,
        ] ,
        [ click ] ) ;
    clk.elements.clickRadius.step(0.01) ;

    // defibrilation -----------------------------------------------------
    var dfb = panel.addFolder("Defibrillation") ;
    dfb.elements = addToGui( dfb, env.defib, 
        [
            "mx",
            "my",
            "electrodeSize" ,
            "thickness" ,
            "uThreshold" ,
            "vThreshold" 
        ] , [] ) ;
   
    dfb.add(env.defib,'defibrillate') ;
    dfb.open() ;
    // csv files ---------------------------------------------------------
    var csv = panel.addFolder('Save and Load CSV') ;
    csv.add(env,'csvFileName' ) ;
    csv.add(env,'saveCsvFile' ) ;
    csv.add(env.loadCsvFile , 'click').name('loadCsvFile') ;

    // execution ---------------------------------------------------------
    var exe = panel.addFolder('Execution') ;
    exe.add(env,'time').listen() ;
    exe.add(env,'skip') ;
    exe.add(env,'initialize') ;
    //exe.add(env,'alwaysRefresh').name("Always Refresh Disp").listen() ; 
    exe.add(env,'running').name("Running/Solve/Pause").listen() ; 
    exe.open() ;
}

// execute createGui to create the graphical user interface ..............
createGui() ;

// execute run function to initiate simulation ...........................
run() ;

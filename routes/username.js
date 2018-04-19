var express = require('express');
var router = express.Router();

/* GET home page. */
const NOUNS = ["3DPrinter","Maker","Inventor","Creator","Scientist","Engineer","Designer","Programmer","Robot","LaserCutter","Knitter","Chip","Ink","Electron","Proton","Artist","Arduino","Hacker","Button","Sensor","PowerSupply","Transistor","Resistor","Capacitor","LED","Coil","Motor","Actuator","Ribbon","Pin","Scissors","Filament","Thimble", "Needle", "Hammer"];
const ADJECTIVES = ["Antimatter","Crafty","Terrific","Ubiquitous","Rebellious","Efficacious","Fastidious","Jocular","Playful","Nefarious","Zealous","Ambiguous","Auspicious","Berserk","Bustling","Calculating","Colossal","Decisive","Dynamic","Elastic","Ethereal","Exuberant","Fabulous","Fearless","Grandiose","Harmonious","Hypnotic","Incandescent","Invincible","Nebulous","Nimble","Omniscient","Quirky","Stupendous","Thundering","Whimsical","Malevolent","Spooky","Majestic","Epic","Humble"];

router.get('/', function(req, res, next) {
  let name = ADJECTIVES[Math.floor(Math.random()*ADJECTIVES.length)] + NOUNS[Math.floor(Math.random()*NOUNS.length)];
  res.json({name});
});

module.exports = router;

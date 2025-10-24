// @ts-check
const express = require('express');
const router = express.Router();


router.get('/', function(req, res) {
  res.render('public/home.html', {});
});

router.get('/home', function(req, res) {
  res.render('public/home.html', {});
});

router.get('/how', function(req, res) {
  res.render('public/how.html', {});
});

router.get('/bring', function(req, res) {
  res.render('public/bring.html', {});
});

module.exports = router;

var cloudant = require('cloudant')({url: 'http://localhost:5984', plugin:'promises'});
var dbname = 'mydb';
var db = null;
var fs = require('fs');
var assert = require('assert');
var  main = require('../detach.js');

describe("doc", function() {

  before(function() {
    db = cloudant.db.use(dbname);
    return cloudant.db.create(dbname).then(function(reply) {
      return db.insert({_id: 'noattachments', a:1,b:2});
    }).then(function(response) {
      return db.insert({_id: 'attachments', a:1, b:2});
    }).then(function(response) {
      var data = fs.readFileSync('./test/fox.png');
      return db.attachment.insert('attachments','rabbit.png', data, 'image/png', response);
    }).then(function(response) {
      var data = fs.readFileSync('./test/fox.png');
      return db.attachment.insert('attachments','fox.png', data, 'image/png', response);
    });
  });

  it('there should be a document with attachments', function() {
    return db.get('attachments').then(function(data) {
      assert.equal(typeof data, 'object');
      assert.equal(typeof data._attachments, 'object');
      return null;
    })
  });

  it('there should be a document without attachments', function() {
    return db.get('noattachments').then(function(data) {
      assert.equal(typeof data, 'object');
      assert.equal(typeof data._attachments, 'undefined');
      return null;
    })
  });

  it('should have a main function', function() {
    assert.equal(typeof main, 'function');
    return null;
  });
  
  //['id', 'dbname', 'cloudantURL', 'objectStorageCredentials']
  it('should return err for missing id', function() {
    var opts = {
      cloudantURL: 'http://localhost:5984',
      dbname: dbname,
      objectStoreCredentials: {
      }
    };
    var d = main(opts);
    assert(typeof d, 'object');
    assert(typeof d.err, 'string');
    return null;
  });

  it('should return err for missing id', function() {
    var opts = {
      cloudantURL: 'http://localhost:5984',
      id: 'attachments',
      objectStoreCredentials: {
      }
    };
    var d = main(opts);
    assert(typeof d, 'object');
    assert(typeof d.err, 'string');
    return null;
  });

  it('should return err for missing dbname', function() {
    var opts = {
      dbname: dbname,
      id: 'attachments',
      objectStoreCredentials: {
      }
    };
    var d = main(opts);
    assert(typeof d, 'object');
    assert(typeof d.err, 'string');
    return null;
  });

  it('should return err for missing objectStoreCredentials', function() {
    var opts = {
      cloudantURL: 'http://localhost:5984',
      dbname: dbname,
      id: 'attachments',
    };
    var d = main(opts);
    assert(typeof d, 'object');
    assert(typeof d.err, 'string');
    return null;
  });



  after(function() {
    return cloudant.db.destroy(dbname);
  })
})
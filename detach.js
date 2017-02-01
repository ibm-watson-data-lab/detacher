
var pkgcloud = require('pkgcloud');

/* message should be of the form:
{

 // from the _changes feed trigger
 "dbname": "mydatabase", 
 "id": "mydocumentid",

 // our configuration
 "cloudantURL": "https://username:password@hostname.cloudant.com",


 // object storage credentials
 "objectStorageCredentials": {
  "auth_url": "https://identity.open.softlayer.com",
  "domainId": "524d4ff43a1b38c6c6718886dfbb279e",
  "domainName": "72244",
  "password": "tfj2ufwbwuGqgw=G",
  "project": "object_storage_123_4567",
  "projectId": "1234567",
  "region": "dallas",
  "role": "admin",
  "userId": "f850a5eb5484ed57b50648693fde445e",
  "username": "admin_325557bde2abb165357707cee6962f6244a062d2"
 }

}
*/

function main(message) {

  // check for required parameters
  var requiredParams = ['id', 'dbname', 'cloudantURL', 'objectStorageCredentials'];
  var errs = [];
  requiredParams.forEach(function(p) {
    if (!message[p]) {
      errs.push(p + 'is a required parameter of this OpenWhisk action');
    }
  });
  if (errs.length > 0) {
    return { err: errs };
  }

  // setup Cloudant library - we need to two Cloudant connections
  // 1) using the "promises" plugin so we can use the Cloudant library with promises
  // 2) using hte "default" plugin so we can get a readable stream of the attachment data
  var cloudant = require('cloudant')({url: message.cloudantURL, plugin: 'promises'});
  var cloudantStream = require('cloudant')({url: message.cloudantURL});
  var db = cloudant.use(message.dbname);
  var dbStream = cloudantStream.use(message.dbname);

  // fetch the JSON document
  return db.get(message.id).then(function(doc) {

    // if there are attachments
    if (typeof doc._attachments === 'object' ) {
      
      // our new array of Object Store attachments
      var attachments = [];

      // list of Promises
      var tasks = [];

      // for each attachment name
      Object.keys(doc._attachments).forEach(function(attName) {

        // get an HTTP stream of its data and pause it
        var rs =  dbStream.attachment.get(message.id, attName); 
        rs.pause();

        // save the file to object storage, adding the Promise to the list
        var p = saveFile(message.objectStorageCredentials, rs, 'uploads', doc._id + '-' + attName).then(function(data) {
          attachments.push(data);
        });
        tasks.push(p);

      });

      // when all the Promises are resolved
      return Promise.all(tasks).then(function() {
        // save the document data, removing the Cloudant attachment
        // but leaving an "attachments" array with references to the 
        // object storage versions
        delete doc._attachments;
        doc.attachments = attachments;
        return db.insert(doc);
      }).then(function(data) {
        return { attachments: attachments, data: data };
      })

    } else {
      return ({msg: 'no attachments found in docId' + message.id});
    }

  });
}


// save a stream of data to object storage
// creds - the object storage credentials
// rs - the ReadStream of data
// directory - the sub-directory to place the data
// filename - the filename to save it as
var saveFile = function(creds, rs, directory, filename) {

  // convert Bluemix Object Storage credentials to pkgcloud format
  var config = {
      provider: 'openstack',
      useServiceCatalog: true,
      useInternal: false,
      keystoneAuthVersion: 'v3',
      authUrl: creds.auth_url,
      tenantId: creds.projectId,    
      domainId: creds.domainId,
      username: creds.username,
      password: creds.password,
      region: creds.region   
  };
  var storageClient = pkgcloud.storage.createClient(config);

  // return a Promise
  return new Promise(function(resolve, reject) {

    // authenticate the object storage client library
    storageClient.auth(function(err) {
      if (err) {
        return reject(err);
      }

      // create the container
      storageClient.createContainer({name: directory}, function(err, container) {

        // upload the file
        var upload = storageClient.upload({
          container: container.name,
          remote: filename
        });

        // if it fails, reject the Promise
        upload.on('error', function(err) {
          reject(err);
        });

        // if it succeeds, resolve the Promise
        upload.on('success', function(file) {
          resolve(file.toJSON())
        });

        // pipe the readstream to object storage
        rs.pipe(upload);
        rs.resume();
      });
    });
  });
};

module.exports = main;
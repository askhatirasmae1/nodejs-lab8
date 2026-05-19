const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Le fichier doit être une image JPG, JPEG, PNG, GIF ou WebP.'), false);
  }
};

function cleanupFiles(files) {
  if (files && typeof files === 'object' && !Array.isArray(files)) {
    Object.keys(files).forEach((key) => {
      files[key].forEach((file) => {
        fs.unlink(file.path, (err) => {
          if (err) console.error('Erreur suppression fichier:', err);
        });
      });
    });
  } else if (Array.isArray(files)) {
    files.forEach((file) => {
      fs.unlink(file.path, (err) => {
        if (err) console.error('Erreur suppression fichier:', err);
      });
    });
  } else if (files && files.path) {
    fs.unlink(files.path, (err) => {
      if (err) console.error('Erreur suppression fichier:', err);
    });
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const uploadMixed = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'galerie', maxCount: 2 }
]);

function formatError(err) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return 'Le fichier est trop volumineux. La taille maximale autorisée est de 5 Mo.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'Trop de fichiers téléversés ou nom de champ incorrect.';
  }

  return err.message;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.post(
  '/upload',
  upload.single('fichier'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).send('Aucun fichier téléversé.');
    }

    res.send(`
      <h1>Fichier téléversé avec succès</h1>
      <p>Nom original: ${req.file.originalname}</p>
      <p>Taille: ${req.file.size} octets</p>
      <p>Type: ${req.file.mimetype}</p>
      <img src="/uploads/${req.file.filename}" style="max-width:500px;">
      <p><a href="/">Retour à l'accueil</a></p>
    `);
  },
  (err, req, res, next) => {
    if (req.file) cleanupFiles(req.file);

    res.status(400).send(`
      <h1>Erreur lors du téléversement</h1>
      <p>${formatError(err)}</p>
      <p><a href="/">Retour à l'accueil</a></p>
    `);
  }
);

app.post(
  '/upload-multiple',
  upload.array('fichiers', 3),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).send('Aucun fichier téléversé.');
    }

    const fileList = req.files
      .map((file) => {
        return `
          <li>
            <p>${file.originalname} (${file.size} octets)</p>
            <img src="/uploads/${file.filename}" style="max-width:300px; margin:10px 0;">
          </li>
        `;
      })
      .join('');

    res.send(`
      <h1>Fichiers téléversés avec succès</h1>
      <p>Nombre de fichiers: ${req.files.length}</p>
      <ul style="list-style:none;">${fileList}</ul>
      <p><a href="/">Retour à l'accueil</a></p>
    `);
  },
  (err, req, res, next) => {
    if (req.files) cleanupFiles(req.files);

    res.status(400).send(`
      <h1>Erreur upload multiple</h1>
      <p>${formatError(err)}</p>
      <p><a href="/">Retour à l'accueil</a></p>
    `);
  }
);

app.post(
  '/upload-with-data',
  uploadMixed,
  (req, res) => {
    if (!req.files || !req.files.image) {
      return res.status(400).send("L'image principale est requise.");
    }

    const titre = req.body.titre || 'Sans titre';
    const description = req.body.description || 'Aucune description';

    const mainImage = req.files.image[0];
    const galerieImages = req.files.galerie || [];

    const galerieHtml = galerieImages
      .map((img) => {
        return `
          <div>
            <img src="/uploads/${img.filename}" style="max-width:250px;">
            <p>${img.originalname}</p>
          </div>
        `;
      })
      .join('');

    res.send(`
      <h1>${titre}</h1>
      <p>${description}</p>

      <h3>Image principale</h3>
      <img src="/uploads/${mainImage.filename}" style="max-width:500px;">

      <h3>Galerie</h3>
      <div style="display:flex; gap:20px; flex-wrap:wrap;">
        ${galerieHtml}
      </div>

      <p><a href="/">Retour à l'accueil</a></p>
    `);
  },
  (err, req, res, next) => {
    if (req.files) cleanupFiles(req.files);

    res.status(400).send(`
      <h1>Erreur upload avec données</h1>
      <p>${formatError(err)}</p>
      <p><a href="/">Retour à l'accueil</a></p>
    `);
  }
);

app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});
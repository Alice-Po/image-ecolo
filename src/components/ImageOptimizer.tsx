import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import {
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  Paper,
  Slider,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import * as faceapi from "face-api.js";
import React, { useEffect, useRef, useState } from "react";
import { ReactCrop, type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useImageProcessor } from "../hooks/useImageProcessor";
import {
  calculateCompressionRatio,
  formatFileSize,
  getCroppedImg,
  hasMetadata,
} from "../utils/imageUtils";

const ImageOptimizer: React.FC = () => {
  const {
    loading,
    originalImage,
    compressedImage,
    originalStats,
    compressedStats,
    metadata,
    canvasRef,
    processImage,
    setOriginalImage,
    reset,
  } = useImageProcessor();

  const [quality, setQuality] = useState<number>(75);
  const [maxWidth, setMaxWidth] = useState<number>(1920);
  const [applyStyle, setApplyStyle] = useState<boolean>(true);
  const [colorCount, setColorCount] = useState<number>(8);
  const [applyBlur, setApplyBlur] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>(
    "Patience, votre image est en cours de traitement..",
  );

  useEffect(() => {
    const loadModels = async () => {
      try {
        console.log(
          "Début du chargement des modèles de détection de visages...",
        );
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
        console.log("Modèle de détection de visages chargé avec succès");
        setModelsLoaded(true);
      } catch (error) {
        console.error("Erreur lors du chargement des modèles:", error);
        setModelsLoaded(false);
      }
    };
    loadModels();
  }, []);

  // Effet pour changer le message après 3 secondes
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (loading) {
      setLoadingMessage("Patience, votre image est en cours de traitement..");
      timeoutId = setTimeout(() => {
        setLoadingMessage("Ok c'est vrai que c'est un peu long..");
      }, 5000);
      timeoutId = setTimeout(() => {
        setLoadingMessage("Ca vient ! Ca vient !");
      }, 8000);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading]);

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOriginalImage(file);
    await processImage(file, {
      quality,
      maxWidth,
      applyStyle,
      applyBlur,
      colorCount,
    });
  };

  const handleQualityChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setQuality(value);
    if (originalImage) {
      debouncedProcessImage(originalImage, {
        quality: value,
        maxWidth,
        applyStyle,
        applyBlur,
        colorCount,
      });
      console.log("mise a jour sur changement sur un slide effectué");
    }
  };

  const handleMaxWidthChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setMaxWidth(value);
    if (originalImage) {
      processImage(originalImage, {
        quality,
        maxWidth: value,
        applyStyle,
        applyBlur,
        colorCount,
      });
    }
  };

  const handleColorCountChange = (
    _event: Event,
    newValue: number | number[],
  ) => {
    const value = newValue as number;
    setColorCount(value);
    if (originalImage) {
      processImage(originalImage, {
        quality,
        maxWidth,
        applyStyle,
        applyBlur,
        colorCount: value,
      });
    }
  };

  const handleStyleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setApplyStyle(value);
    if (originalImage) {
      processImage(originalImage, {
        quality,
        maxWidth,
        applyStyle: value,
        applyBlur,
        colorCount,
      });
    }
  };

  const handleBlurChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setApplyBlur(value);
    if (originalImage) {
      processImage(originalImage, {
        quality,
        maxWidth,
        applyStyle,
        applyBlur: value,
        colorCount,
      });
    }
  };

  const downloadImage = () => {
    if (!compressedImage) return;

    const link = document.createElement("a");
    link.href = compressedImage;
    link.download = "optimized-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRotation = async () => {
    if (!originalImage) return;
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);

    // Retraiter l'image avec la nouvelle rotation
    await processImage(originalImage, {
      quality,
      maxWidth,
      applyStyle,
      applyBlur,
      colorCount,
      rotation: newRotation,
    });
  };

  const handleCropComplete = async () => {
    if (!imageRef.current || !crop.width || !crop.height) return;

    try {
      const croppedBlob = await getCroppedImg(imageRef.current, crop, quality);
      const croppedFile = new File([croppedBlob], "cropped.jpg", {
        type: "image/jpeg",
      });

      await processImage(croppedFile, {
        quality,
        maxWidth,
        applyStyle,
        applyBlur,
        colorCount,
      });

      setIsCropping(false);
    } catch (error) {
      console.error("Erreur lors du recadrage:", error);
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Optimiseur d&apos;Images <small>Beta</small>
        </Typography>
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography component="div" variant="body2" sx={{ mb: 2 }}>
            <strong>Fonctionnalités :</strong>
            <ul>
              <li>Compression intelligente avec contrôle de la qualité</li>
              <li>Floutage automatique des visages</li>
              <li>Outils de recadrage et rotation</li>
              <li>Lecture des meta-données</li>
            </ul>
          </Typography>
          <Typography
            variant="body2"
            color="primary"
            sx={{ fontWeight: "medium" }}
          >
            ✨ Toutes les images sont traitées localement dans votre navigateur
            - Aucun envoi sur un serveur !
          </Typography>
        </Paper>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<CloudUploadIcon />}
          >
            Télécharger une image
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleImageUpload}
            />
          </Button>
        </Box>

        {originalStats && compressedStats && (
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Image originale:
                </Typography>
                <Typography>
                  • Taille: {formatFileSize(originalStats.size)}
                </Typography>
                <Typography>
                  • Dimensions: {originalStats.width}x{originalStats.height}px
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Image compressée:
                </Typography>
                <Typography>
                  • Taille: {formatFileSize(compressedStats.size)}
                </Typography>
                <Typography>
                  • Dimensions: {compressedStats.width}x{compressedStats.height}
                  px
                </Typography>
                <Typography>
                  • Réduction:{" "}
                  {calculateCompressionRatio(originalStats, compressedStats)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Qualité de compression (%)</Typography>
            <Slider
              value={quality}
              onChange={handleQualityChange}
              min={0}
              max={100}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>Largeur maximale (px)</Typography>
            <Slider
              value={maxWidth}
              onChange={handleMaxWidthChange}
              min={100}
              max={3840}
              step={100}
              valueLabelDisplay="auto"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item>
            <FormControlLabel
              control={
                <Switch checked={applyStyle} onChange={handleStyleChange} />
              }
              label="Appliquer l'effet de dithering"
            />
          </Grid>
          {applyStyle && (
            <>
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>Nombre de couleurs</Typography>
                <Slider
                  value={colorCount}
                  onChange={handleColorCountChange}
                  min={2}
                  max={32}
                  step={1}
                  marks={[
                    { value: 2, label: "2" },
                    { value: 8, label: "8" },
                    { value: 16, label: "16" },
                    { value: 32, label: "32" },
                  ]}
                  valueLabelDisplay="auto"
                />
              </Grid>
            </>
          )}
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={applyBlur}
                  onChange={handleBlurChange}
                  disabled={!modelsLoaded}
                />
              }
              label="Flouter les visages"
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Image originale
            </Typography>
            {originalImage && (
              <Box
                component="img"
                src={URL.createObjectURL(originalImage)}
                sx={{ maxWidth: "100%", height: "auto" }}
                alt="Original"
              />
            )}
            {metadata && (
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Métadonnées de l&apos;image
                </Typography>
                {hasMetadata(metadata) ? (
                  <Grid container spacing={2}>
                    {metadata.Make && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>Appareil:</strong> {metadata.Make}{" "}
                          {metadata.Model}
                        </Typography>
                      </Grid>
                    )}
                    {metadata.DateTimeOriginal && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>Date de prise:</strong>{" "}
                          {new Date(metadata.DateTimeOriginal).toLocaleString()}
                        </Typography>
                      </Grid>
                    )}
                    {metadata.ExposureTime && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>Temps d&apos;exposition:</strong>{" "}
                          {metadata.ExposureTime}s
                        </Typography>
                      </Grid>
                    )}
                    {metadata.FNumber && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>Ouverture:</strong> f/{metadata.FNumber}
                        </Typography>
                      </Grid>
                    )}
                    {metadata.ISO && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>ISO:</strong> {metadata.ISO}
                        </Typography>
                      </Grid>
                    )}
                    {metadata.FocalLength && (
                      <Grid item xs={12} sm={6}>
                        <Typography>
                          <strong>Distance focale:</strong>{" "}
                          {metadata.FocalLength}mm
                        </Typography>
                      </Grid>
                    )}
                    {metadata.latitude && metadata.longitude && (
                      <Grid item xs={12}>
                        <Typography>
                          <strong>Localisation:</strong>{" "}
                          {metadata.latitude.toFixed(6)},{" "}
                          {metadata.longitude.toFixed(6)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                ) : (
                  <Typography
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    Aucune métadonnée n&apos;est disponible pour cette image.
                  </Typography>
                )}
              </Paper>
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ position: "relative" }}>
              <Typography variant="subtitle1" gutterBottom>
                Image optimisée
              </Typography>
              {loading ? (
                <>
                  <Box
                    component="img"
                    src="/loading-3887_256.gif"
                    sx={{
                      maxWidth: "100%",
                      height: "auto",
                      display: "block",
                      margin: "0 auto",
                    }}
                    alt="Chargement en cours..."
                  />
                  <Typography
                    color="text.secondary"
                    sx={{
                      textAlign: "center",
                      mt: 2,
                      fontStyle: "italic",
                    }}
                  >
                    {loadingMessage}
                  </Typography>
                </>
              ) : (
                compressedImage && (
                  <>
                    {isCropping ? (
                      <ReactCrop
                        crop={crop}
                        onChange={(c: Crop) => setCrop(c)}
                        aspect={undefined}
                      >
                        <img
                          ref={imageRef}
                          src={compressedImage}
                          style={{ maxWidth: "100%" }}
                          alt="À recadrer"
                        />
                      </ReactCrop>
                    ) : (
                      <Box
                        component="img"
                        src={compressedImage}
                        sx={{ maxWidth: "100%", height: "auto" }}
                        alt="Compressed"
                      />
                    )}
                    <Typography
                      color="text.secondary"
                      sx={{ fontStyle: "italic" }}
                    >
                      Les metadonnées ont été automatiquement supprimées pendant
                      le traitement.
                    </Typography>
                    <Box
                      sx={{
                        mt: 2,
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                      }}
                    >
                      <Tooltip title="Pivoter l'image">
                        <IconButton onClick={handleRotation} color="primary">
                          <RotateRightIcon />
                        </IconButton>
                      </Tooltip>
                      {isCropping ? (
                        <>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleCropComplete}
                          >
                            Appliquer le recadrage
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => setIsCropping(false)}
                          >
                            Annuler
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outlined"
                            onClick={() => setIsCropping(true)}
                          >
                            Recadrer
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={downloadImage}
                          >
                            Télécharger l&apos;image optimisée
                          </Button>
                        </>
                      )}
                    </Box>
                  </>
                )
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <Box
        component="footer"
        sx={{
          p: 2,
          mt: 3,
          borderTop: 1,
          borderColor: "divider",
          textAlign: "center",
          backgroundColor: "background.paper",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Les contributions sont les bienvenues !
          <Link
            href="https://github.com/Alice-Po/image-ecolo"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ ml: 1 }}
          >
            Voir le projet sur GitHub
          </Link>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Made in Boccagia{" "}
        </Typography>
      </Box>
    </Card>
  );
};

export default ImageOptimizer;

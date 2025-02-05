/**
 * ImageOptimizer Component
 *
 * A comprehensive image processing component that provides various optimization and editing features.
 * All processing is done locally in the browser without server uploads.
 *
 * Features:
 * - Image compression with quality control
 * - Face detection and automatic blurring
 * - Image cropping and rotation
 * - Dithering effect with customizable color palette
 * - EXIF metadata extraction
 *
 * @component
 */

import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DownloadIcon from "@mui/icons-material/Download";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
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
import { useDebounce } from "../hooks/useDebounce";
import { useImageProcessor } from "../hooks/useImageProcessor";
import {
  calculateCompressionRatio,
  formatFileSize,
  getCroppedImg,
  hasMetadata,
} from "../utils/imageUtils";

/**
 * Main ImageOptimizer component that handles all image processing operations
 * @returns {JSX.Element} The rendered component
 */
const ImageOptimizer: React.FC = () => {
  const {
    loading,
    progress,
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
  const [maxWidthLimit, setMaxWidthLimit] = useState<number>(3840);

  /**
   * Debounced function that handles parameter changes for image processing
   * Prevents excessive reprocessing when sliding controls
   *
   * @param {Object} params - The parameters to update
   * @param {string} params.name - The name of the parameter to update (quality, maxWidth, or colorCount)
   * @param {number} params.value - The new value for the parameter
   */
  const debouncedProcessWithParams = useDebounce(
    (params: { name: string; value: number }) => {
      if (!originalImage) return;

      const options = {
        quality,
        maxWidth,
        applyStyle,
        applyBlur,
        colorCount,
        [params.name]: params.value,
      };

      processImage(originalImage, options);
    },
    500,
  );

  /**
   * Handles changes to the quality slider
   * Updates the quality state and triggers debounced image processing
   *
   * @param {Event} _event - The event object (unused)
   * @param {number | number[]} newValue - The new quality value
   */
  const handleQualityChange = (_event: Event, newValue: number | number[]) => {
    const value = newValue as number;
    setQuality(value);
    debouncedProcessWithParams({ name: "quality", value });
  };

  /**
   * Handles changes to the maximum width slider
   * Updates the maxWidth state and triggers debounced image processing
   * The maximum width is limited to the original image width
   *
   * @param {Event} _event - The event object (unused)
   * @param {number | number[]} newValue - The new maximum width value
   */
  const handleMaxWidthChange = (_event: Event, newValue: number | number[]) => {
    const value = Math.min(newValue as number, maxWidthLimit);
    setMaxWidth(value);
    debouncedProcessWithParams({ name: "maxWidth", value });
  };

  /**
   * Handles changes to the color count slider for dithering effect
   * Updates the colorCount state and triggers debounced image processing
   *
   * @param {Event} _event - The event object (unused)
   * @param {number | number[]} newValue - The new color count value
   */
  const handleColorCountChange = (
    _event: Event,
    newValue: number | number[],
  ) => {
    const value = newValue as number;
    setColorCount(value);
    debouncedProcessWithParams({ name: "colorCount", value });
  };

  /**
   * Handles toggling of the dithering effect
   * Immediately processes the image with the new style setting
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - The change event
   */
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

  /**
   * Handles toggling of the face blur effect
   * Immediately processes the image with the new blur setting
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - The change event
   */
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

  /**
   * Initiates download of the processed image
   * Creates a temporary link element to trigger the download
   */
  const downloadImage = () => {
    if (!compressedImage) return;

    const link = document.createElement("a");
    link.href = compressedImage;
    link.download = "optimized-image.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Handles image rotation in 90-degree increments
   * Immediately processes the image with the new rotation
   */
  const handleRotation = async () => {
    if (!originalImage) return;
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);

    await processImage(originalImage, {
      quality,
      maxWidth,
      applyStyle,
      applyBlur,
      colorCount,
      rotation: newRotation,
    });
  };

  /**
   * Completes the cropping operation
   * Creates a new image from the cropped area and processes it
   */
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

  /**
   * Effect hook to load face detection models on component mount
   * Initializes the face-api.js models for face detection and blurring
   */
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

  /**
   * Effect hook to manage loading messages
   * Updates the loading message with humorous text based on processing duration
   * Messages change at 5s and 8s intervals
   */
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

  /**
   * Handles initial image upload
   * Sets the original image and triggers initial processing
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event
   */
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

  useEffect(() => {
    if (originalStats?.width) {
      if (maxWidth > originalStats.width) {
        setMaxWidth(originalStats.width);
      }
      setMaxWidthLimit(originalStats.width);
    }
  }, [originalStats?.width]);

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
              <li>Lecture et effacement des meta-données</li>
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
          <Paper
            sx={{
              p: 3,
              mb: 3,
              bgcolor: "background.paper",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                gap: 4,
                alignItems: "center",
                position: "relative",
              }}
            >
              {/* Colonne de gauche - Image originale */}
              <Box
                sx={{
                  flex: 1,
                  width: "100%",
                  p: 2,
                  bgcolor: "#1E1E1E",
                  borderRadius: 1,
                  textAlign: "center",
                }}
              >
                <Typography variant="h6" gutterBottom color="grey.300">
                  Image originale
                </Typography>
                <Typography variant="h4" color="grey.100" sx={{ mb: 1 }}>
                  {formatFileSize(originalStats.size)}
                </Typography>
                <Typography color="grey.400">
                  {originalStats.width} × {originalStats.height}px
                </Typography>
              </Box>

              {/* Indicateur central de réduction */}
              <Box
                sx={{
                  position: { xs: "relative", md: "absolute" },
                  left: { md: "50%" },
                  transform: { md: "translateX(-50%)" },
                  zIndex: 2,
                  width: 180,
                  height: 180,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {loading ? (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#1E1E1E",
                      borderRadius: "50%",
                    }}
                  >
                    <CircularProgress
                      size={60}
                      thickness={4}
                      sx={{ color: "#9DFF20" }}
                    />
                  </Box>
                ) : (
                  <>
                    <Box
                      sx={{
                        width: "100%",
                        height: "100%",
                        position: "absolute",
                        background: `conic-gradient(
                          #9DFF20 0deg,
                          #9DFF20 ${parseFloat(calculateCompressionRatio(originalStats, compressedStats)) * 3.6}deg,
                          transparent ${parseFloat(calculateCompressionRatio(originalStats, compressedStats)) * 3.6}deg
                        )`,
                        borderRadius: "50%",
                        transform: "rotate(-90deg)",
                      }}
                    />
                    <Box
                      sx={{
                        width: "92%",
                        height: "92%",
                        bgcolor: "#1E1E1E",
                        borderRadius: "50%",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: "bold",
                          color: "#9DFF20",
                          lineHeight: 1,
                        }}
                      >
                        {calculateCompressionRatio(
                          originalStats,
                          compressedStats,
                        )}
                      </Typography>
                      <Typography
                        sx={{
                          color: "rgba(255,255,255,0.7)",
                          fontSize: "0.875rem",
                        }}
                      >
                        de réduction
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>

              {/* Colonne de droite - Image compressée */}
              <Box
                sx={{
                  flex: 1,
                  width: "100%",
                  p: 2,
                  bgcolor: loading ? "#1E1E1E" : "#9DFF20",
                  borderRadius: 1,
                  textAlign: "center",
                  position: "relative",
                  transition: "background-color 0.3s ease",
                  "&::before": !loading
                    ? {
                        content: '""',
                        position: "absolute",
                        left: -100,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 100,
                        height: 100,
                        background: "#9DFF20",
                        clipPath: "circle(50% at 100% 50%)",
                      }
                    : undefined,
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{
                    color: loading ? "grey.300" : "rgba(0, 0, 0, 0.87)",
                    transition: "color 0.3s ease",
                  }}
                >
                  Image optimisée
                </Typography>
                {loading ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 100,
                    }}
                  >
                    <CircularProgress sx={{ color: "#9DFF20" }} />
                  </Box>
                ) : (
                  <>
                    <Typography
                      variant="h4"
                      sx={{
                        color: "rgba(0, 0, 0, 0.87)",
                        mb: 1,
                        fontWeight: "bold",
                      }}
                    >
                      {formatFileSize(compressedStats.size)}
                    </Typography>
                    <Typography sx={{ color: "rgba(0, 0, 0, 0.7)" }}>
                      {compressedStats.width} × {compressedStats.height}px
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {!loading && (
              <Typography
                variant="body1"
                sx={{
                  mt: 3,
                  textAlign: "center",
                  color: "#9DFF20",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  display: "inline-block",
                  margin: "0 auto",
                  marginTop: 3,
                }}
              >
                {parseFloat(
                  calculateCompressionRatio(originalStats, compressedStats),
                ) >= 70
                  ? "Excellente optimisation ! 🎉"
                  : parseFloat(
                        calculateCompressionRatio(
                          originalStats,
                          compressedStats,
                        ),
                      ) >= 40
                    ? "Bonne optimisation"
                    : "Optimisation modérée"}
              </Typography>
            )}
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
            <Typography gutterBottom>
              Largeur maximale (px)
              {originalStats?.width ? ` (max: ${originalStats.width}px)` : ""}
            </Typography>
            <Slider
              value={maxWidth}
              onChange={handleMaxWidthChange}
              min={100}
              max={maxWidthLimit}
              step={100}
              valueLabelDisplay="auto"
              disabled={!originalImage}
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
                  <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Typography
                      color="text.secondary"
                      sx={{
                        fontStyle: "italic",
                        mb: 1,
                      }}
                    >
                      {loadingMessage}
                    </Typography>
                    {progress.step && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.9em",
                        }}
                      >
                        {`${progress.step} : ${Math.round(progress.value)}%`}
                      </Typography>
                    )}
                  </Box>
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

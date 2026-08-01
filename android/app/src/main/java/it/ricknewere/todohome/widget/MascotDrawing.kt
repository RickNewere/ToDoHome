package it.ricknewere.todohome.widget

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import it.ricknewere.todohome.data.Mood

/**
 * Casimiro, drawn with Canvas so the widget needs no image assets.
 *
 * The geometry is a straight port of the SVG in web/src/components/Mascot.tsx:
 * both are laid out in the same 120 x 128 space, so the two look identical.
 */
object MascotDrawing {

    private const val ART_W = 120f
    private const val ART_H = 128f
    private const val INK = "#1E293B"

    private data class Palette(val main: Int, val dark: Int, val light: Int)

    private data class Face(
        val browOuter: Float,
        val browInner: Float,
        val pupilDy: Float,
        val pupilR: Float,
        val mouthCp: Float,
        val openMouth: Boolean,
        val steam: Boolean,
        val vein: Boolean,
        val sparkles: Boolean,
    )

    private fun palette(mood: Mood) = when (mood) {
        Mood.HAPPY -> Palette(0xFF22C55E.toInt(), 0xFF15803D.toInt(), 0xFFDCFCE7.toInt())
        Mood.CALM -> Palette(0xFF3B82F6.toInt(), 0xFF1D4ED8.toInt(), 0xFFDBEAFE.toInt())
        Mood.ANNOYED -> Palette(0xFFF59E0B.toInt(), 0xFFB45309.toInt(), 0xFFFEF3C7.toInt())
        Mood.ANGRY -> Palette(0xFFEF4444.toInt(), 0xFFB91C1C.toInt(), 0xFFFEE2E2.toInt())
        Mood.FURIOUS -> Palette(0xFF991B1B.toInt(), 0xFF7F1D1D.toInt(), 0xFFFECACA.toInt())
    }

    private fun face(mood: Mood) = when (mood) {
        Mood.HAPPY -> Face(64f, 58f, -1f, 5.5f, 116f, false, false, false, true)
        Mood.CALM -> Face(62f, 62f, 0f, 5.5f, 109f, false, false, false, false)
        Mood.ANNOYED -> Face(60f, 68f, 1f, 5.5f, 97f, false, false, false, false)
        Mood.ANGRY -> Face(57f, 72f, 2f, 5f, 92f, true, false, false, false)
        Mood.FURIOUS -> Face(54f, 74f, 2.5f, 4.5f, 90f, true, true, true, false)
    }

    /** Renders the mascot into a bitmap [widthPx] wide, keeping the 120:128 ratio. */
    fun render(mood: Mood, widthPx: Int): Bitmap {
        val w = widthPx.coerceAtLeast(24)
        val h = (w * ART_H / ART_W).toInt()
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.scale(w / ART_W, h / ART_H)
        draw(canvas, mood)
        return bitmap
    }

    private fun draw(c: Canvas, mood: Mood) {
        val p = palette(mood)
        val f = face(mood)

        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }

        // Steam out of the chimney, behind everything else
        if (f.steam) {
            fill.color = p.dark
            fill.alpha = 115
            c.drawCircle(86f, 6f, 4f, fill)
            c.drawCircle(95f, 3f, 5.5f, fill)
            c.drawCircle(104f, 8f, 4.5f, fill)
            fill.alpha = 255
        }

        // Chimney, drawn before the roof so the roof hides its base
        fill.color = p.dark
        c.drawRoundRect(RectF(86f, 14f, 99f, 42f), 3f, 3f, fill)

        // Roof
        val roof = Path().apply {
            moveTo(4f, 55f)
            lineTo(60f, 7f)
            lineTo(116f, 55f)
            close()
        }
        fill.color = p.main
        c.drawPath(roof, fill)
        stroke.color = p.dark
        stroke.strokeWidth = 3f
        c.drawPath(roof, stroke)

        // Shingle hint
        stroke.strokeWidth = 1.6f
        stroke.alpha = 71
        c.drawPath(
            Path().apply {
                moveTo(20f, 48f)
                lineTo(60f, 14f)
                lineTo(100f, 48f)
            },
            stroke,
        )
        stroke.alpha = 255

        // Body
        val body = RectF(16f, 50f, 104f, 116f)
        fill.color = p.light
        c.drawRoundRect(body, 14f, 14f, fill)
        stroke.strokeWidth = 3f
        c.drawRoundRect(body, 14f, 14f, stroke)

        // Anger vein on the cheek
        if (f.vein) {
            stroke.strokeWidth = 2.8f
            c.drawPath(
                Path().apply {
                    moveTo(21f, 96f); lineTo(27f, 90f); lineTo(33f, 96f)
                },
                stroke,
            )
            c.drawPath(
                Path().apply {
                    moveTo(21f, 104f); lineTo(27f, 98f); lineTo(33f, 104f)
                },
                stroke,
            )
        }

        // Eyes: the windows of the house
        stroke.strokeWidth = 2.6f
        for (cx in floatArrayOf(44f, 76f)) {
            val eye = RectF(cx - 11.5f, 80f - 12.5f, cx + 11.5f, 80f + 12.5f)
            fill.color = Color.WHITE
            c.drawOval(eye, fill)
            c.drawOval(eye, stroke)
        }
        fill.color = Color.parseColor(INK)
        for (cx in floatArrayOf(44f, 76f)) {
            c.drawCircle(cx, 80f + f.pupilDy, f.pupilR, fill)
        }

        // Eyebrows, over the eyes so an angry brow presses into them
        stroke.strokeWidth = 6f
        c.drawLine(30f, f.browOuter, 56f, f.browInner, stroke)
        c.drawLine(90f, f.browOuter, 64f, f.browInner, stroke)

        // Mouth
        if (f.openMouth) {
            fill.color = Color.parseColor(INK)
            c.drawPath(
                Path().apply {
                    moveTo(44f, 96f)
                    quadTo(60f, 91f, 76f, 96f)
                    quadTo(76f, 115f, 60f, 115f)
                    quadTo(44f, 115f, 44f, 96f)
                    close()
                },
                fill,
            )
            fill.color = Color.WHITE
            c.drawPath(
                Path().apply {
                    moveTo(45f, 97f); lineTo(50f, 104f); lineTo(55f, 97f); lineTo(60f, 104f)
                    lineTo(65f, 97f); lineTo(70f, 104f); lineTo(75f, 97f)
                    close()
                },
                fill,
            )
        } else {
            stroke.color = Color.parseColor(INK)
            stroke.strokeWidth = 5f
            c.drawPath(
                Path().apply {
                    moveTo(46f, 102f)
                    quadTo(60f, f.mouthCp, 74f, 102f)
                },
                stroke,
            )
        }

        // Sparkles when the house is spotless
        if (f.sparkles) {
            fill.color = p.main
            c.drawPath(sparkle(14f, 30f, 7f), fill)
            c.drawPath(sparkle(107f, 24f, 5f), fill)
        }
    }

    private fun sparkle(cx: Float, cy: Float, s: Float) = Path().apply {
        moveTo(cx, cy - s)
        quadTo(cx, cy, cx + s, cy)
        quadTo(cx, cy, cx, cy + s)
        quadTo(cx, cy, cx - s, cy)
        quadTo(cx, cy, cx, cy - s)
        close()
    }
}

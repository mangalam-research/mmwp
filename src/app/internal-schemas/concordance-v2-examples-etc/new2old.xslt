<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:template match="@*|node()">
        <xsl:copy>
            <xsl:apply-templates select="@*|node()" />
        </xsl:copy>
    </xsl:template>
    <xsl:template match="export">
        <concordance><xsl:apply-templates select="@*|node()" /></concordance>
    </xsl:template>
    <xsl:template match="export/header">
        <heading><xsl:apply-templates select="@*|node()" /></heading>
    </xsl:template>
    <xsl:template match="export/concordance">
        <lines><xsl:apply-templates select="@*|node()" /></lines>
    </xsl:template>
    <xsl:template match="export/concordance/line">
        <line><xsl:apply-templates select="@*|node()" /></line>
    </xsl:template>
    <xsl:template match="export/concordance/line/left">
        <left_context><xsl:apply-templates select="@*|node()" /></left_context>
    </xsl:template>
    <xsl:template match="export/concordance/line/kwic">
        <kwic><xsl:apply-templates select="@*|node()" /></kwic>
    </xsl:template>
    <xsl:template match="export/concordance/line/right">
        <right_context><xsl:apply-templates select="@*|node()" /></right_context>
    </xsl:template>
</xsl:stylesheet>

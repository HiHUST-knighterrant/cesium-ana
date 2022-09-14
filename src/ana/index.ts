import { Cartesian3, Cartographic, Color, Entity, JulianDate, Viewer } from 'cesium';
import { GraphManager } from 'cesium-plotting-symbol';
import * as turf from '@turf/turf';
import * as R from 'ramda';
import { Feature, featureCollection, FeatureCollection, Point, Polygon } from '@turf/turf';


export default class CesiumAnalyzer {

  private viewer: Viewer
  private gm: GraphManager

  constructor(viewer: Viewer) {
    this.viewer = viewer
    this.gm = new GraphManager(viewer, {
      layerId: 'ana',
      editAfterCreate: true
    })
  }

  private cellSide = 100;
  private options = { units: 'meters' };

  private getHeightNum(lon: number, lat: number): number {
    let co = Cartographic.fromDegrees(lon, lat)
    let hei = this.viewer.scene.globe.getHeight(co)
    return hei
  }

  public createHeightLine() {
    let g = this.gm.create({ obj: 'Polygon', fill: false, outlineColor: "#00ff00", outlineWidth: 3, outline: true })
    this.gm.setGraphFinishHandler((graph) => {
      let pos = graph.getCtlPositionsPos()
      let points: Array<Array<number>> = pos.map(p => [p.lon, p.lat])

      //get bbox
      let bx = turf.bbox(turf.lineString(points))
      console.log("get bbox: ", bx)

      //get point grid
      var grid = turf.pointGrid(bx, this.cellSide, this.options);
      console.log("get grid: ", grid)

      //get mask polygon
      let points2 = points.concat([points[0]])
      let maskPolygon = turf.polygon([points2])
      console.log("get orging polygon: ", maskPolygon)

      //get filtered point grid
      let filtered = grid //turf.pointsWithinPolygon(grid, maskPolygon)
      console.log("get filtered points: ", filtered)

      //generate height data
      let cts = filtered
      cts.features
        .map((f, i) => {
          let co = f.geometry.coordinates
          let hei = this.getHeightNum(co[0], co[1])
          f.properties.height = hei
          f.properties.index = i
          return f
        })
      console.log("get heights: ", cts)

      //get top and bottom
      let top = R.reduce(R.maxBy(p => p.properties.height), cts.features[0], cts.features)
      let bottom = R.reduce(R.minBy(p => p.properties.height), cts.features[0], cts.features)
      console.log("get tiptop: ", top, bottom)

      let topHei = top.properties.height
      let bottomHei = bottom.properties.height
      let delta = (topHei - bottomHei) / 4
      let breaks = [bottomHei, bottomHei + delta * 1, bottomHei + delta * 2, bottomHei + delta * 3, topHei]
      console.log("get breaks: ", breaks)
      let hlines = turf.isolines(cts, breaks, { zProperty: "height" })
      console.log("get height lines: ", hlines)

      hlines.features.map(lines => {
        let lineHei: number = lines.properties.height
        lines.geometry.coordinates.map(line => {
          let poss = line.map( p =>
            Cartesian3.fromDegrees(p[0], p[1], lineHei)
          )
          this.viewer.entities.add(new Entity({
            polyline: {
              width: 2,
              positions: poss,
              material: Color.fromCssColorString("#00ff00"),
              clampToGround: true,
            }
          }))
        })
      }) // end drawing hlines

    })
  }

}

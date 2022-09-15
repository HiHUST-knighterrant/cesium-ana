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

  private cellSide = 50;
  private options = { units: 'meters' };

  private heiBreakNum = 10

  private getHeightNum(lon: number, lat: number): number {
    let co = Cartographic.fromDegrees(lon, lat)
    let hei = this.viewer.scene.globe.getHeight(co)
    return hei
  }

  public createHeightLine() {
    let g = this.gm.create({ obj: 'Rectangle', fill: true, alpha: 0.2 })

    this.gm.setGraphFinishHandler((graph) => {
      if (!graph.isHeightLined) {
        this.drawHeightLine(graph)
      } else {
        console.log("hight line is drawed")
      }
    })
  }

  private getBreaks(grid: FeatureCollection): Array<number> {
    let top = R.reduce(R.maxBy(p => p.properties.height), grid.features[0], grid.features)
    let bottom = R.reduce(R.minBy(p => p.properties.height), grid.features[0], grid.features)
    let topHei = top.properties.height
    let bottomHei = bottom.properties.height
    console.log("get tiptop: ", topHei, bottomHei)

    let delta = (topHei - bottomHei) / this.heiBreakNum
    let breaks = []
    for (let i = 0; i < this.heiBreakNum + 1; i++) {
      let hei = bottomHei + delta * i
      breaks.push(hei)
    }
    console.log("get breaks: ", breaks)
    return breaks
  }

  private drawHeightLine(graph) {
    let pos = graph.getCtlPositionsPos()
    let points: Array<Array<number>> = [
      [pos[0].lon, pos[0].lat],
      [pos[1].lon, pos[0].lat],
      [pos[1].lon, pos[1].lat],
      [pos[0].lon, pos[1].lat],
    ] //pos.map(p => [p.lon, p.lat])

    //get bbox
    let bx = turf.bbox(turf.lineString(points))
    console.log("get bbox: ", bx)

    //get point grid
    var grid = turf.pointGrid(bx, this.cellSide, this.options);
    console.log("get grid: ", grid)

    //generate height data
    grid.features
      .map((f, i) => {
        let co = f.geometry.coordinates
        let hei = this.getHeightNum(co[0], co[1])
        f.properties.height = hei
        f.properties.index = i
        return f
      })
    console.log("get heights: ", grid)

    let breaks = this.getBreaks(grid)

    let hlines = turf.isolines(grid, breaks, { zProperty: "height" })
    console.log("get height lines: ", hlines)

    hlines.features.map(lines => {
      let lineHei: number = lines.properties.height
      lines.geometry.coordinates.map(line => {
        let poss = line.map(p =>
          Cartesian3.fromDegrees(p[0], p[1], lineHei)
        )
        this.viewer.entities.add(new Entity({
          polyline: {
            width: 2,
            positions: poss,
            material: Color.fromCssColorString("#ff0000"),
            clampToGround: true,
          }
        }))
      })
    }) // end drawing hlines
    graph.isHeightLined = true
  }

}

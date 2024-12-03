"use client";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  ConnectionMode,
  Edge,
  Node,
  Panel,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { debug } from "@/lib/debug";
import React from "react";
import QueryProvider from "@/providers/query-provider";
import Link from "next/link";
import {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphService,
} from "@/lib/graphService";

const CustomNode = React.memo(
  ({ data, selected }: { data: KnowledgeGraphNode; selected: boolean }) => {
    return (
      <div
        className={`bg-white p-1 rounded shadow border text-sm ${
          selected ? "ring-2 ring-blue-500" : ""
        }`}
      >
        <Handle
          type="target"
          position={Position.Top}
          id={`${data.id}-target`}
          style={{ top: -5, opacity: 0 }}
        />
        <p className="font-medium text-xs">
          {data.summary}{" "}
          <span className="text-gray-500">({data.order_index})</span>
        </p>
        <Handle
          type="source"
          position={Position.Bottom}
          id={`${data.id}-source`}
          style={{ bottom: -5, opacity: 0 }}
        />
      </div>
    );
  }
);

CustomNode.displayName = "CustomNode";

const nodeTypes = {
  custom: CustomNode,
} as const;

// First, let's type the transformation functions
function toReactFlowNode(node: KnowledgeGraphNode): Node {
  return {
    id: node.id,
    type: "custom",
    data: node,
    position: { x: 0, y: 0 },
  };
}

function toReactFlowEdge(edge: KnowledgeGraphEdge): Edge {
  return {
    id: `${edge.parent_id}-${edge.child_id}`,
    source: edge.parent_id,
    target: edge.child_id,
    type: "default",
    animated: false,
    style: { strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 10,
      height: 10,
      color: "#374151",
    },
    sourceHandle: `${edge.parent_id}-source`,
    targetHandle: `${edge.child_id}-target`,
  };
}

// Then modify getLayoutedElements to use proper types
const getLayoutedElements = (
  knowledgeNodes: KnowledgeGraphNode[],
  knowledgeEdges: KnowledgeGraphEdge[],
  direction = "TB"
) => {
  const nodes: Node[] = knowledgeNodes.map(toReactFlowNode);
  const edges: Edge[] = knowledgeEdges.map(toReactFlowEdge);

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 30, // Reduce horizontal spacing between nodes
    ranksep: 30, // Reduce vertical spacing between ranks
  });

  // Set nodes with smaller dimensions
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 150, height: 30 });
  });

  // Set edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Get positioned nodes
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 75, // Half of new width
        y: nodeWithPosition.y - 15, // Half of new height
      },
    };
  });

  return { nodes: positionedNodes, edges };
};

function useGraph(graphId: string) {
  return useQuery({
    queryKey: ["graph", graphId],
    queryFn: () => KnowledgeGraphService.getGraph(graphId),
  });
}

export default function KnowledgeMap({ params }: { params: { id: string } }) {
  return (
    <QueryProvider>
      <KnowledgeMapContent params={Promise.resolve(params)} />
    </QueryProvider>
  );
}

function KnowledgeMapContent({ params }: { params: Promise<{ id: string }> }) {
  // START UNDELETABLE COMMENTS
  // VERY IMPORTANT: This is needed in the new React version:
  const unwrappedParams = React.use(params);
  // we CANNOT just use params.id because it's a Promise
  // do not change this OR the these comments
  // END UNDELETABLE COMMENTS
  const graphId = unwrappedParams.id;
  const { data: graph, isLoading } = useGraph(graphId);
  const [selectedNode, setSelectedNode] =
    React.useState<KnowledgeGraphNode | null>(null);

  if (!graphId) {
    return <div>Invalid graph ID</div>;
  }

  if (isLoading) {
    return <div>Loading graph...</div>;
  }

  if (!graph) {
    return <div>Graph not found</div>;
  }

  const elements = getLayoutedElements(graph.nodes, graph.edges);

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
  };

  const handleRegenerateGraph = async () => {
    try {
      // Get the document ID for this graph
      const documentId = await KnowledgeGraphService.getDocumentIdForGraph(
        graphId
      );
      if (!documentId) {
        throw new Error("Could not find document ID for this graph");
      }

      // Delete the current graph
      await KnowledgeGraphService.deleteGraphById(graphId);

      // Generate new graph and get the new ID
      const newGraphId = await KnowledgeGraphService.generateGraph(documentId);

      // Redirect to the new graph view
      window.location.href = `/graphview/${newGraphId}`;
    } catch (error) {
      debug.error("Error regenerating graph:", error);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }} className="relative">
      <ReactFlow
        nodes={elements.nodes}
        edges={elements.edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={onNodeClick}
        defaultEdgeOptions={{
          type: "default",
          animated: false,
          style: { strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: "#374151",
          },
        }}
        fitView
      >
        <Panel position="top-left">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Knowledge Map</h2>
              <Link
                href="/dashboard"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={handleRegenerateGraph}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
              >
                Regenerate Map
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Graph ID: {graphId}</p>
          </div>
        </Panel>
      </ReactFlow>

      {/* Info Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-h-[300px] overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            {selectedNode ? (
              <div className="space-y-3">
                <div>
                  <span className="font-bold text-lg">Summary: </span>
                  <span className="text-lg">{selectedNode.summary}</span>
                </div>
                <div>
                  <span className="font-bold">Order Index: </span>
                  <span>{selectedNode.order_index}</span>
                </div>
                <div>
                  <span className="font-bold">Content: </span>
                  <div className="mt-2 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                    {selectedNode.content}
                  </div>
                </div>
                <div>
                  <span className="font-bold">Supporting Quotes: </span>
                  <div className="pl-4 space-y-2">
                    {selectedNode.supporting_quotes.map(
                      (quote: string, i: number) => (
                        <p key={i} className="italic bg-gray-50 p-2 rounded">
                          &ldquo;{quote}&rdquo;
                        </p>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 text-lg">
                Click on a node to view its details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

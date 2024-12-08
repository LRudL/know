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
import { MockDate } from "@/components/MockDate";
import { MockReview } from "@/components/MockReview";
import { LearningService, SpacedRepState } from "@/lib/learningService";
import { dateService } from "@/lib/date";
import { NodeReviewStateVisualization } from "@/components/NodeReviewStateVisualization";
import { Header } from "@/components/Header";
import { Flex, Text, Button, Separator, Grid } from "@radix-ui/themes";
import { ClockIcon, ChatBubbleIcon, CaretRightIcon } from "@radix-ui/react-icons";

console.log("React version:", React.version);
console.log("Node version:", process.version);

const CustomNode = React.memo(
  ({
    data,
    selected,
  }: {
    data: KnowledgeGraphNode & {
      spaced_rep_state: SpacedRepState | null;
      graphId: string;
    };
    selected: boolean;
  }) => {
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
        <NodeReviewStateVisualization
          spaced_rep_state={data.spaced_rep_state}
        />
        <MockReview nodeId={data.id} graphId={data.graphId} />
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
function toReactFlowNode(node: KnowledgeGraphNode, graphId: string): Node {
  return {
    id: node.id,
    type: "custom",
    data: { ...node, graphId },
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
  graphId: string,
  direction = "TB"
) => {
  const nodes: Node[] = knowledgeNodes.map((node) =>
    toReactFlowNode(node, graphId)
  );
  const edges: Edge[] = knowledgeEdges.map(toReactFlowEdge);

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 80,
    ranksep: 100,
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

export default function KnowledgeMap({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <QueryProvider>
      <KnowledgeMapContent params={params} />
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
  const { data: graph, isLoading: isLoadingGraph } = useGraph(graphId);

  // Query for learning state
  const {
    data: learningState,
    isLoading: isLoadingLearning,
    refetch,
  } = useQuery({
    queryKey: ["learningState", graphId],
    queryFn: () =>
      LearningService.getGraphLearningState(graphId, dateService.now()),
    enabled: !!graphId,
  });

  const [selectedNode, setSelectedNode] =
    React.useState<KnowledgeGraphNode | null>(null);

  if (!graphId) {
    return <div>Invalid graph ID</div>;
  }

  if (isLoadingGraph || isLoadingLearning) {
    return <div>Loading graph...</div>;
  }

  if (!graph) {
    return <div>Graph not found</div>;
  }

  // Merge graph nodes with learning state
  const nodesWithState = graph.nodes.map((node) => {
    let spaced_rep_state = null;

    // Check each category in learning state
    const inPast = learningState?.past.find((n) => n.node.id === node.id);
    const inToReview = learningState?.to_review.find(
      (n) => n.node.id === node.id
    );
    const inNotYetLearned = learningState?.not_yet_learned.find(
      (n) => n.node.id === node.id
    );

    if (inPast) {
      spaced_rep_state = inPast.spaced_rep_state;
    } else if (inToReview) {
      spaced_rep_state = inToReview.spaced_rep_state;
    } else if (inNotYetLearned) {
      spaced_rep_state = inNotYetLearned.spaced_rep_state;
    }

    return {
      ...node,
      spaced_rep_state,
    };
  });

  const elements = getLayoutedElements(
    nodesWithState.map((node) => ({ ...node })),
    graph.edges,
    graphId
  );

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.data);
  };

  return (
    <Flex
      className="graph-background"
      style={{  
        backgroundColor: "var(--color-background)"
      }} 
      display="flex"
      width="100%"
      height="100vh"
      direction="column"
      align="start"
    >
      <Header />
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
    </Flex>
  );
}
